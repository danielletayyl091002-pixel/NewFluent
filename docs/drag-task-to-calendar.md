# Drag tasks → calendar slot — implementation plan

**Status:** deferred from the "complete all" round. Documented here so the
next session can ship it with full context.

## The core problem

`/board` and the calendar view (rendered inside `/page/[uid]?view=calendar`)
live on different routes. dnd-kit's `<DndContext>` doesn't cross route
boundaries, so a task card on the board cannot natively be dragged onto a
calendar grid cell.

The Sunsama-style flow we want:

1. User opens the dashboard
2. Sees today's unscheduled tasks alongside the schedule
3. Drags a task onto a calendar time slot
4. Task gains `scheduledDate` + `startTime` + `endTime` and appears on the
   calendar immediately

## Recommended approach (smallest viable scope)

**Don't unify the board with the calendar.** Instead, make the dashboard's
own "Today's tasks" + the right-rail mini calendar share one DnD context.
Drag from the task list to a mini-calendar slot. That's where users will
naturally do daily planning anyway.

### Changes

1. **Wrap the dashboard in `<DndContext>`** (new top-level provider in
   `TodayDashboard.tsx`).

2. **Make each task in the Tasks section a draggable.** Use
   `useDraggable({ id: 'task:' + task.uid })`. Visual: drag handle dot on
   hover, `<DragOverlay>` shows a ghost card.

3. **Make the right-rail mini calendar's hour cells droppable.** In
   `RightRail.tsx > Timeline`, each hour row gets `useDroppable({
   id: 'cal:' + dateStr + ':' + hour })` (where `hour` is the integer
   hour the cell starts at). Visual: cell highlights in accent color
   when a task is dragged over it.

4. **On drop:**
   ```ts
   const onDragEnd = ({ active, over }) => {
     if (!over) return
     const taskUid = String(active.id).slice(5)        // 'task:...'
     const [_, dateStr, hour] = String(over.id).split(':')
     const startTime = `${String(hour).padStart(2,'0')}:00`
     const endTime = `${String(Math.min(23, +hour + 1)).padStart(2,'0')}:00`
     await db.tasks.where('uid').equals(taskUid).modify({
       scheduledDate: dateStr,
       startTime, endTime,
       itemType: 'event',  // promote to event so it renders on calendar
     })
   }
   ```

5. **Cross-route bonus.** Once this works in the dashboard, copy the same
   draggable wrapper to `BoardView.tsx` task cards. The Board would
   then ALSO be draggable to the right rail (which is mounted on every
   route). Same DnD context per route — works because the rail is
   rendered alongside the board.

## What to test after building

- [ ] Drag a task → drop on hour 9 → task appears on calendar at 9-10am
- [ ] Drag, then cancel drop (drop on empty space) → task unchanged
- [ ] Drag onto an occupied slot → still works (no overlap detection yet)
- [ ] Drag a task that's already scheduled → re-schedules to new time
- [ ] Mobile: long-press to start drag (dnd-kit `TouchSensor`)
- [ ] Existing calendar drag/resize still works (most likely break point)
- [ ] Existing right-rail drag-to-create still works (the cells gain a
      droppable handler; the existing onMouseDown still fires)

## Risk: collision with existing right-rail drag-to-create

The right rail's `<Timeline>` already uses raw `onMouseDown` to drag-create
events. dnd-kit's `useDroppable` doesn't conflict — it just attaches a ref.
The `onMouseDown` will still fire on empty cell click. But verify carefully
that dnd-kit's pointer sensor (`activationConstraint: { distance: 8 }`)
doesn't swallow the mousedown when starting from a draggable task above.

## Estimated effort

- Wrap dashboard + add task draggable: 20 min
- Make timeline cells droppable + visual hover state: 30 min
- Drop handler + DB update + state refresh: 20 min
- Mobile touch sensor + manual QA: 30 min
- Total: ~1.5 hr

## Why we deferred

Bundling this into a multi-feature commit is exactly how the calendar
drag/resize regressions we already fixed twice would re-appear. It deserves
its own session with focused testing.
