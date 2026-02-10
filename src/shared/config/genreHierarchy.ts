/**
 * Site-wide genre list. Only these genres are used (favorites, book pages, recommendations).
 * Order and labels must match backend whitelist.
 */

export interface GenreGroup {
  main: string;
  secondaries: string[];
}

export const GENRE_HIERARCHY: GenreGroup[] = [
  {
    main: 'Arts',
    secondaries: [
      'Architecture', 'Art Instruction', 'Art History', 'Dance', 'Design', 'Fashion', 'Film',
      'Graphic Design', 'Music', 'Music Theory', 'Painting', 'Photography',
    ],
  },
  {
    main: 'Fiction',
    secondaries: [
      'Fantasy', 'Historical Fiction', 'Horror', 'Humor', 'Literature', 'Magic',
      'Mystery and detective stories', 'Plays', 'Poetry', 'Romance', 'Science Fiction',
      'Short Stories', 'Thriller', 'Young Adult',
    ],
  },
  {
    main: 'Science & Mathematics',
    secondaries: ['Biology', 'Chemistry', 'Mathematics', 'Physics', 'Programming'],
  },
  {
    main: 'Business & Finance',
    secondaries: ['Management', 'Entrepreneurship', 'Business Economics', 'Business Success', 'Finance'],
  },
  {
    main: "Children's",
    secondaries: ['Kids Books', 'Stories in Rhyme', 'Baby Books', 'Bedtime Books', 'Picture Books'],
  },
  {
    main: 'History',
    secondaries: ['Ancient Civilization', 'Archaeology', 'Anthropology', 'World War II', 'Social Life and Customs'],
  },
  {
    main: 'Health & Wellness',
    secondaries: ['Cooking', 'Cookbooks', 'Mental Health', 'Exercise', 'Nutrition', 'Self-help'],
  },
  {
    main: 'Biography',
    secondaries: ['Autobiographies', 'History', 'Politics and Government', 'World War II', 'Women', 'Kings and Rulers', 'Composers', 'Artists'],
  },
  {
    main: 'Social Sciences',
    secondaries: ['Anthropology', 'Religion', 'Political Science', 'Psychology'],
  },
];

export function getAllSelectableGenres(): string[] {
  const set = new Set<string>();
  for (const group of GENRE_HIERARCHY) {
    set.add(group.main);
    for (const s of group.secondaries) set.add(s);
  }
  return Array.from(set);
}
