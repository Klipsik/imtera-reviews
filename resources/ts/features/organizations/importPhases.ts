export const importPhaseLabels: Record<string, string> = {
  pending: 'Ожидание',
  parsing_org: 'Загружаем карточку организации',
  parsing_reviews: 'Загружаем отзывы',
  saving: 'Сохраняем отзывы',
  completed: 'Готово',
  failed: 'Ошибка',
}

export function importPhaseLabel(phase: string, message?: string | null): string | null {
  if (message) {
    return message
  }

  return importPhaseLabels[phase] ?? null
}
