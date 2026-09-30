import { MockExamType, MockSkill, Prisma } from '@prisma/client';

/** Editable starting points, without placeholder questions or answer keys. */
export function starterSections(type: MockExamType): Prisma.MockSectionCreateWithoutExamInput[] {
  const ielts = type !== 'multilevel';
  return (['listening', 'reading', 'writing', 'speaking'] as MockSkill[]).map((skill, sortOrder) => {
    const count = ielts ? { listening: 4, reading: 3, writing: 2, speaking: 3 }[skill] : 1;
    const unit = skill === 'reading' ? 'Passage' : skill === 'writing' ? 'Task' : 'Part';
    return {
      skill,
      sortOrder,
      title: skill[0].toUpperCase() + skill.slice(1),
      ...(ielts && (skill === 'reading' || skill === 'writing') ? { durationMinutes: 60 } : {}),
      groups: {
        create: Array.from({ length: count }, (_, index) => ({
          title: `${unit} ${index + 1}`,
          sortOrder: index,
          ...(skill === 'listening' ? { partNumber: index + 1, audioPlayLimit: 1 } : {}),
        })),
      },
    };
  });
}
