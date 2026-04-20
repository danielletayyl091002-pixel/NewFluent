import { useEffect, useState } from 'react'
import { db } from '@/db/schema'

export function useSidebarVisibility() {
  const [leftVisible, setLeftVisible] = useState(true)
  const [rightVisible, setRightVisible] = useState(true)

  useEffect(() => {
    const load = async () => {
      const left = await db.settings
        .where('key').equals('left_sidebar_visible').first()
      const right = await db.settings
        .where('key').equals('right_sidebar_visible').first()
      setLeftVisible(left?.value !== 'false')
      setRightVisible(right?.value !== 'false')
    }
    load()
  }, [])

  const toggleLeft = async () => {
    const newVal = !leftVisible
    setLeftVisible(newVal)
    const existing = await db.settings
      .where('key').equals('left_sidebar_visible').first()
    if (existing?.id)
      await db.settings.update(existing.id, { value: String(newVal) })
    else
      await db.settings.add({ key: 'left_sidebar_visible', value: String(newVal) })
  }

  const toggleRight = async () => {
    const newVal = !rightVisible
    setRightVisible(newVal)
    const existing = await db.settings
      .where('key').equals('right_sidebar_visible').first()
    if (existing?.id)
      await db.settings.update(existing.id, { value: String(newVal) })
    else
      await db.settings.add({ key: 'right_sidebar_visible', value: String(newVal) })
  }

  return { leftVisible, rightVisible, toggleLeft, toggleRight }
}
