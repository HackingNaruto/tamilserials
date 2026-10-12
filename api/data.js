// Data Store for Tamildhool Clone
const channels = [
  {
    id: "vijay-tv",
    name: "Vijay TV",
    tagline: "Star Vijay Serials & Reality Shows",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Star_Vijay_logo.svg/320px-Star_Vijay_logo.svg.png",
    color: "#e50014",
    banner: "https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?w=1200&auto=format&fit=crop&q=80"
  },
  {
    id: "sun-tv",
    name: "Sun TV",
    tagline: "Sun Network Daily Prime Serials",
    logo: "https://upload.wikimedia.org/wikipedia/en/thumb/8/87/Sun_TV_logo.svg/320px-Sun_TV_logo.svg.png",
    color: "#ff8c00",
    banner: "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=1200&auto=format&fit=crop&q=80"
  },
  {
    id: "zee-tamil",
    name: "Zee Tamil",
    tagline: "Zee Entertainment Tamil Serials",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Zee_Tamil_logo_2023.svg/320px-Zee_Tamil_logo_2023.svg.png",
    color: "#1a73e8",
    banner: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200&auto=format&fit=crop&q=80"
  },
  {
    id: "colors-tamil",
    name: "Colors Tamil",
    tagline: "Colors TV Tamil Shows",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Colors_Tamil_Logo.svg/320px-Colors_Tamil_Logo.svg.png",
    color: "#9c27b0",
    banner: "https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=1200&auto=format&fit=crop&q=80"
  },
  {
    id: "reality-shows",
    name: "Reality Shows",
    tagline: "Bigg Boss, Cook with Comali, Super Singer & Special Shows",
    logo: "https://cdn-icons-png.flaticon.com/512/3845/3845868.png",
    color: "#00c853",
    banner: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop&q=80"
  }
];

const shows = [
  {
    id: "siragadikka-aasai",
    title: "Siragadikka Aasai",
    tamilTitle: "சிறகடிக்க ஆசை",
    channelId: "vijay-tv",
    channelName: "Vijay TV",
    time: "9:30 PM",
    genre: "Family Drama / Romance",
    rating: "4.8",
    thumbnail: "https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=600&auto=format&fit=crop&q=80",
    banner: "https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=1200&auto=format&fit=crop&q=80",
    description: "The heartwarming story of Muthu and Meena facing life struggles together with emotional family moments.",
    totalEpisodes: 520
  },
  {
    id: "baakiyalakshmi",
    title: "Baakiyalakshmi",
    tamilTitle: "பாக்கியலட்சுமி",
    channelId: "vijay-tv",
    channelName: "Vijay TV",
    time: "8:30 PM",
    genre: "Family Drama / Women Empowerment",
    rating: "4.7",
    thumbnail: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80",
    banner: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1200&auto=format&fit=crop&q=80",
    description: "Baakiya's inspiring journey of transforming from an unappreciated homemaker into an independent entrepreneur.",
    totalEpisodes: 1180
  },
  {
    id: "pandian-stores-2",
    title: "Pandian Stores 2",
    tamilTitle: "பாண்டியன் ஸ்டோர்ஸ் 2",
    channelId: "vijay-tv",
    channelName: "Vijay TV",
    time: "8:00 PM",
    genre: "Family Drama",
    rating: "4.6",
    thumbnail: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&auto=format&fit=crop&q=80",
    banner: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=1200&auto=format&fit=crop&q=80",
    description: "The second chapter of the famous joint family bond, brotherhood, and generational challenges.",
    totalEpisodes: 310
  },
  {
    id: "bigg-boss-tamil",
    title: "Bigg Boss Tamil Season 8",
    tamilTitle: "பிக் பாஸ் தமிழ் சீசன் 8",
    channelId: "reality-shows",
    channelName: "Vijay TV / Reality",
    time: "9:30 PM (Daily)",
    genre: "Reality TV / Entertainment",
    rating: "4.9",
    thumbnail: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80",
    banner: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop&q=80",
    description: "Contestants from varied backgrounds live together in an isolated house under 24/7 camera surveillance with intense drama and weekly tasks.",
    totalEpisodes: 105
  },
  {
    id: "singapennae",
    title: "Singapennae",
    tamilTitle: "சிங்கப்பெண்ணே",
    channelId: "sun-tv",
    channelName: "Sun TV",
    time: "8:00 PM",
    genre: "Social Drama / Woman Leadership",
    rating: "4.9",
    thumbnail: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&auto=format&fit=crop&q=80",
    banner: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1200&auto=format&fit=crop&q=80",
    description: "Anandi, a brave village girl, steps into the city garment factory to shoulder her family burdens and overcomes all hurdles.",
    totalEpisodes: 420
  },
  {
    id: "kayal",
    title: "Kayal",
    tamilTitle: "கயல்",
    channelId: "sun-tv",
    channelName: "Sun TV",
    time: "7:30 PM",
    genre: "Family / Emotional Drama",
    rating: "4.8",
    thumbnail: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&auto=format&fit=crop&q=80",
    banner: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=1200&auto=format&fit=crop&q=80",
    description: "Kayal, a hardworking young nurse, is the sole breadwinner sacrificing her personal happiness for her ungrateful siblings.",
    totalEpisodes: 960
  },
  {
    id: "marumagal",
    title: "Marumagal",
    tamilTitle: "மருமகள்",
    channelId: "sun-tv",
    channelName: "Sun TV",
    time: "8:30 PM",
    genre: "Romance / Family",
    rating: "4.6",
    thumbnail: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop&q=80",
    banner: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1200&auto=format&fit=crop&q=80",
    description: "A lively tale of relationship dynamics and modern in-law interactions filled with comedy and sentiment.",
    totalEpisodes: 180
  },
  {
    id: "karthigai-dheepam",
    title: "Karthigai Dheepam",
    tamilTitle: "கார்த்திகை தீபம்",
    channelId: "zee-tamil",
    channelName: "Zee Tamil",
    time: "9:00 PM",
    genre: "Drama / Romance",
    rating: "4.7",
    thumbnail: "https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=600&auto=format&fit=crop&q=80",
    banner: "https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=1200&auto=format&fit=crop&q=80",
    description: "Deepa's melodic singing voice touches millions despite societal prejudice about her appearance.",
    totalEpisodes: 640
  },
  {
    id: "sandhya-raagam",
    title: "Sandhya Raagam",
    tamilTitle: "சந்தியா ராகம்",
    channelId: "zee-tamil",
    channelName: "Zee Tamil",
    time: "7:00 PM",
    genre: "Family Emotions",
    rating: "4.5",
    thumbnail: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=600&auto=format&fit=crop&q=80",
    banner: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=1200&auto=format&fit=crop&q=80",
    description: "A touching narrative tracing the intertwined lives of two sisters separated by circumstance and reuniting across generations.",
    totalEpisodes: 380
  },
  {
    id: "kannedhirey-thondrinal",
    title: "Kannedhirey Thondrinal",
    tamilTitle: "கண்ணெதிரே தோன்றினாள்",
    channelId: "colors-tamil",
    channelName: "Colors Tamil",
    time: "7:30 PM",
    genre: "Romance & Suspense",
    rating: "4.4",
    thumbnail: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&auto=format&fit=crop&q=80",
    banner: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=1200&auto=format&fit=crop&q=80",
    description: "A mysterious fate weaves the destinies of two childhood friends destined for emotional conflict.",
    totalEpisodes: 290
  }
];

// Helper to generate episode items
const generateEpisodes = () => {
  const list = [];
  const dates = [
    { date: "11-10-2026", label: "11th October 2026", tag: "TODAY" },
    { date: "10-10-2026", label: "10th October 2026", tag: "YESTERDAY" },
    { date: "09-10-2026", label: "09th October 2026", tag: "PREVIOUS" },
    { date: "08-10-2026", label: "08th October 2026", tag: "PREVIOUS" }
  ];

  shows.forEach((show, showIdx) => {
    dates.forEach((d, dIdx) => {
      const epNum = show.totalEpisodes - dIdx;
      const epId = `${show.id}-ep-${epNum}`;
      
      list.push({
        id: epId,
        showId: show.id,
        showTitle: show.title,
        tamilTitle: show.tamilTitle,
        channelId: show.channelId,
        channelName: show.channelName,
        episodeNumber: epNum,
        title: `${show.title} ${d.label} Episode ${epNum}`,
        date: d.date,
        dateFormatted: d.label,
        tag: d.tag,
        duration: "22 Mins",
        thumbnail: show.thumbnail,
        description: `Watch ${show.title} full episode ${epNum} telecasted on ${d.label}. High Definition Tamil serial streaming online.`,
        servers: [
          {
            name: "Server 1 (Primary HD)",
            type: "embed",
            url: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0",
            badge: "Fast HD"
          },
          {
            name: "Server 2 (Backup 1080p)",
            type: "embed",
            url: "https://player.vimeo.com/video/76979871?h=8272103f6e",
            badge: "1080p"
          },
          {
            name: "Server 3 (Dailymotion / Stream)",
            type: "embed",
            url: "https://www.dailymotion.com/embed/video/x7tgad0",
            badge: "Alternate"
          },
          {
            name: "Server 4 (HLS Direct)",
            type: "hls",
            url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
            badge: "Direct HLS"
          }
        ]
      });
    });
  });

  return list;
};

const episodes = generateEpisodes();

module.exports = {
  channels,
  shows,
  episodes
};
