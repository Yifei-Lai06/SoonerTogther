// Real photography only — free Unsplash License (https://unsplash.com/license),
// hotlinked from Unsplash's CDN with photographer credit. No AI-generated images.

export interface Photo {
  src: string;
  alt: string;
  credit: string;
  page: string;
}

const cdn = (id: string, w = 1200) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

export const PHOTOS = {
  laughingTable: {
    src: cdn("photo-1522202176988-66273c2fd55f"),
    alt: "Three students laughing together around a table with laptops",
    credit: "Brooke Cagle",
    page: "https://unsplash.com/photos/three-people-sitting-in-front-of-table-laughing-together-g1Kr4Ozfoac",
  },
  picnicStudy: {
    src: cdn("photo-1460518451285-97b6aa326961"),
    alt: "Students reading and writing notes together at a wooden picnic table",
    credit: "Alexis Brown",
    page: "https://unsplash.com/photos/people-reading-and-writing-at-table-omeaHbEFlN4",
  },
  coffeeGroup: {
    src: cdn("photo-1543269865-cbf427effbad"),
    alt: "A group of friends talking and smiling at a coffee shop table",
    credit: "Brooke Cagle",
    page: "https://unsplash.com/photos/a-group-of-friends-at-a-coffee-shop--uHVRvDr7pg",
  },
} satisfies Record<string, Photo>;
