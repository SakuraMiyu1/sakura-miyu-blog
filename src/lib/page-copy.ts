type PageMeta = { title: string; description: string; eyebrow: string };
type TopicCopy = { title: string; description: string };
type PageCopy = {
  home: {
    welcomeStrip: string;
    welcomeTitle: string;
    welcomeIntro: string;
    meet: string;
    featuredEyebrow: string;
    featuredTitle: string;
    allEntries: string;
    recentEyebrow: string;
    recentTitle: string;
    topicsEyebrow: string;
    topicsTitle: string;
    quote: string;
    quoteLabel: string;
  };
  pages: Record<'blog' | 'about' | 'writing' | 'archive' | 'tags', PageMeta>;
  about: { heading: string; paragraphs: string[]; quote: string };
  writing: {
    heading: string;
    intro: string;
    projectEyebrow: string;
    projectTitle: string;
    projectDescription: string;
    projectNote: string;
    ideasTitle: string;
    ideas: string;
    entriesTitle: string;
  };
  topics: Record<'diary' | 'anime' | 'cosplay' | 'gaming', TopicCopy>;
  categoryDescription: string;
  categoryEyebrow: string;
  tagTitle: string;
  tagDescription: string;
  tagEyebrow: string;
  notFound: { title: string; description: string; heading: string; eyebrow: string };
};

export const pageCopy: Record<'uk' | 'en' | 'ja', PageCopy> = {
  uk: {
    home: {
      welcomeStrip: 'Трохи життя. Трохи магії. Місце, де я можу бути собою.',
      welcomeTitle: 'Заходь, почувайся як удома.',
      welcomeIntro: 'Я Сакура Мію — закохана в аніме мрійниця, яка збирає маленькі красиві моменти. Тут повсякденне життя зустрічається з уявними світами: трохи рожевого, трохи чорного й багато тепла.',
      meet: 'Познайомся з дівчиною за цими словами',
      featuredEyebrow: 'СТОРІНКА, БЛИЗЬКА МОЄМУ СЕРЦЮ',
      featuredTitle: 'Особливий запис у щоденнику',
      allEntries: 'Усі записи',
      recentEyebrow: 'ЩОДЕННИК ВІДКРИТО',
      recentTitle: 'Нові записи у щоденнику',
      topicsEyebrow: 'ДОСЛУХАЙСЯ ДО ЦІКАВОСТІ',
      topicsTitle: 'Зазирни у мій світ',
      quote: 'Не кожна маленька думка має змінити світ. Деяким просто потрібне місце, щоб розквітнути.',
      quoteLabel: 'З МОГО МАЛЕНЬКОГО НОТАТНИКА'
    },
    pages: {
      blog: { title: 'Маленький щоденник', description: 'Повсякденні миті, уявні світи й слова від серця. Переглянь усі записи або знайди щось близьке собі.', eyebrow: 'ДУМКИ, ІСТОРІЇ Й МАЛЕНЬКІ МРІЇ' },
      about: { title: 'Дівчина за щоденником', description: 'Трохи знайомства — від однієї мрійниці до іншої спорідненої душі.', eyebrow: 'САКУРА МІЮ · さくらみゆ' },
      writing: { title: 'Історії по той бік екрана', description: 'Фанфіки, тихі задуми й уявні світи, які зростають у моєму нотатнику.', eyebrow: 'ПИСЬМОВИЙ СТІЛ' },
      archive: { title: 'Маленький архів', description: 'Колекція днів, мрій і слів, збережених тут, щоб до них повертатися.', eyebrow: 'КОЖНА СТОРІНКА МАЄ СВОЄ МІСЦЕ' },
      tags: { title: 'Ниточки маленьких захоплень', description: 'Вибери тег і подивись, куди приведе твоя цікавість.', eyebrow: 'КОЛЕКЦІЯ ТЕГІВ' }
    },
    about: {
      heading: 'Привіт, я Сакура Мію 🌸',
      paragraphs: [
        'У цьому маленькому куточку інтернету я пишу про повсякденне життя, аніме, косплей, ігри, творчість та історії, які іноді народжуються в моїй уяві.',
        'Люблю аніме, відеоігри, косплей, японську культуру, готичну кавай-моду, творче письмо й маленькі красиві моменти. Це мій маленький світ між реальністю та мріями.',
        'Люблю уявляти, як змінилися б знайомі історії, якби персонаж зробив інший вибір. Іноді ці маленькі ідеї перетворюються на цілі оповіді.',
        'Ще я вивчаю комп’ютерні науки в університеті. Мені подобається, як код зустрічається з творчістю: один допомагає зрозуміти, як усе працює, а інша надихає створити щось власне.',
        'Тут стрічки сусідять із точками збереження, ніжні думки — із задумами історій, а часом з’являються й сторінки про те, чого я навчилася.',
        'Ласкаво прошу в мій маленький світ між реальністю та мріями. Сподіваюся, ти знайдеш тут щось затишне й близьке собі. ♡'
      ],
      quote: 'Іноді цей простір — щоденник. А іноді — двері до уявного світу.'
    },
    writing: {
      heading: 'А що, якби історія пішла іншим шляхом?',
      intro: 'Іноді персонаж залишається зі мною ще довго після завершення історії. Я замислююся про інший вибір, тихішу мить, новий початок. Тут ці думки знаходять свою сторінку.',
      projectEyebrow: 'У МОЄМУ НОТАТНИКУ · ФАНФІК У РОБОТІ',
      projectTitle: 'Інший шлях для Луїзи',
      projectDescription: 'Альтернативна історія, натхненна Луїзою із «Zero no Tsukaima / The Familiar of Zero». Я досліджую, як інший вибір міг би допомогти їй по-новому зрозуміти себе й людей поруч.',
      projectNote: 'Особистий неофіційний трансформативний фанфік. Оригінальні персонажі та світ належать відповідним правовласникам. Діалоги й текст оригіналу тут не відтворюються.',
      ideasTitle: 'Маленькі зернятка історій',
      ideas: 'Лист із місця, якого не може існувати. Знайомий світ, побачений чужими очима. Маленький добрий вчинок, що змінює фінал. Саме такі ідеї я люблю збирати.',
      entriesTitle: 'З письменницького нотатника'
    },
    topics: {
      diary: { title: 'Любий маленький щоденнику', description: 'Маленькі думки, повсякденні миті й прекрасні речі, які хочеться запам’ятати.' },
      anime: { title: 'Трохи магії аніме', description: 'Улюблені персонажі, світи, до яких я повертаюся, та історії, що залишаються зі мною після титрів.' },
      cosplay: { title: 'Стрічки, персонажі та косплей', description: 'Трохи перевтілення, трохи творчості й радість від можливості зазирнути в інший світ.' },
      gaming: { title: 'Точки збереження та мрії', description: 'Віртуальні пригоди, улюблені ігри й маленькі світи, у яких так приємно загубитися.' }
    },
    categoryDescription: 'Маленькі миті та історії з розділу «{name}».',
    categoryEyebrow: 'ВІДКРИЙ МАЛЕНЬКЕ ЗАХОПЛЕННЯ',
    tagTitle: 'Трохи про «{name}»',
    tagDescription: 'Пройди ниточкою «{name}» крізь мій маленький світ.',
    tagEyebrow: 'ТЕГ ІЗ КРАПЛИНОЮ ЛЮБОВІ',
    notFound: {
      title: 'Трохи заблукали',
      description: 'Ця сторінка загубилася десь між реальністю та мріями. Знайдімо дорогу назад.',
      heading: 'Ой~ Ця маленька мрія загубилася!',
      eyebrow: '404 · ДЕСЬ МІЖ РЕАЛЬНІСТЮ ТА МРІЯМИ'
    }
  },
  en: {
    home: {
      welcomeStrip: 'A little life. A little magic. A place to be myself.',
      welcomeTitle: 'Come in, make yourself at home.',
      welcomeIntro: "I'm Sakura Miyu. An anime lover, a daydreamer, and a girl collecting beautiful little moments. Here, everyday life meets imagined worlds — with a little pink, a little black, and a lot of heart.",
      meet: 'Meet the girl behind the words',
      featuredEyebrow: 'A PAGE CLOSE TO MY HEART',
      featuredTitle: 'Featured diary entry',
      allEntries: 'All entries',
      recentEyebrow: 'THE DIARY IS OPEN',
      recentTitle: 'Latest Diary Entries',
      topicsEyebrow: 'FOLLOW YOUR CURIOSITY',
      topicsTitle: 'Explore my world',
      quote: 'Not every little thought needs to change the world. Some just need a place to bloom.',
      quoteLabel: 'FROM MY LITTLE NOTEBOOK'
    },
    pages: {
      blog: { title: 'The little diary', description: 'Everyday moments, imagined worlds, and words from the heart. Browse every entry, or find something that feels like you.', eyebrow: 'THOUGHTS, STORIES & LITTLE DREAMS' },
      about: { title: 'The girl behind the diary', description: 'A little introduction, from one daydreamer to another.', eyebrow: 'SAKURA MIYU · さくらみゆ' },
      writing: { title: 'Stories beyond the screen', description: 'Fanfiction, half-whispered ideas, and the imagined worlds growing in my notebook.', eyebrow: 'THE WRITING DESK' },
      archive: { title: 'The little archive', description: 'A collection of days, dreams, and words — kept here to find again.', eyebrow: 'EVERY PAGE HAS A PLACE' },
      tags: { title: 'Threads of little interests', description: 'Pick a tag and see where your curiosity takes you.', eyebrow: 'THE TAG COLLECTION' }
    },
    about: {
      heading: "Hi, I'm Sakura Miyu 🌸",
      paragraphs: [
        'This little corner of the internet is where I write about everyday life, anime, cosplay, gaming, creativity, and the stories that sometimes appear in my imagination.',
        'I love anime, video games, cosplay, Japanese culture, Gothic Kawaii fashion, creative writing, and beautiful little moments. This is my little world between reality and dreams.',
        'I love wondering how familiar stories might change if a character made a different choice. Sometimes those little ideas become full stories.',
        "I'm also studying Computer Science at university. I like the way code and creativity can meet — one helps me understand how things work, and the other gives me a reason to make something of my own.",
        "Here you'll find ribbons beside save points, soft little thoughts beside story ideas, and the occasional page about learning something new.",
        'Welcome to my little world between reality and dreams. I hope you find something here that feels a little like home. ♡'
      ],
      quote: "Some days, this space is a diary. Other days, it's a door to an imagined world."
    },
    writing: {
      heading: 'What if the story went another way?',
      intro: 'Sometimes a character stays with me long after a story ends. I start wondering about another choice, a quieter moment, a different beginning. This is where those thoughts find a page.',
      projectEyebrow: 'IN MY NOTEBOOK · FANFICTION IN PROGRESS',
      projectTitle: 'Another path for Louise',
      projectDescription: "An alternative story inspired by Louise from Zero no Tsukaima / The Familiar of Zero. I'm exploring how a different choice could lead her towards a new understanding of herself and the people around her.",
      projectNote: 'A personal, unofficial work of transformative fanfiction. The original characters and world belong to their respective rights holders. No original dialogue or source text is reproduced here.',
      ideasTitle: 'Little seeds of stories',
      ideas: "A letter that arrives from an impossible place. A familiar world seen through someone else's eyes. A small act of kindness that changes the ending. These are the kinds of ideas I like to collect.",
      entriesTitle: 'From the writing notebook'
    },
    topics: {
      diary: { title: 'Dear little diary', description: 'Small thoughts, everyday moments, and the beautiful things I want to remember.' },
      anime: { title: 'A little anime magic', description: 'Characters I love, worlds I return to, and stories that stay with me after the credits.' },
      cosplay: { title: 'Ribbons, characters & cosplay', description: 'A little transformation, a little creativity, and the joy of stepping into another world.' },
      gaming: { title: 'Save points & daydreams', description: 'Virtual adventures, favourite games, and little worlds to get wonderfully lost in.' }
    },
    categoryDescription: 'Little moments and stories filed under {name}.',
    categoryEyebrow: 'EXPLORE A LITTLE INTEREST',
    tagTitle: 'A little {name}',
    tagDescription: 'Follow the {name} thread through my little world.',
    tagEyebrow: 'TAGGED WITH A LITTLE LOVE',
    notFound: {
      title: 'A little lost',
      description: "This page has wandered somewhere between reality and dreams. Let's find our way back.",
      heading: 'Oopsie~ This little dream got lost!',
      eyebrow: '404 · SOMEWHERE BETWEEN REALITY & DREAMS'
    }
  },
  ja: {
    home: {
      welcomeStrip: '日々の暮らしに、少しの魔法。私らしくいられる場所。',
      welcomeTitle: 'どうぞ、ゆっくりしていってね。',
      welcomeIntro: 'さくらみゆです。アニメと空想が好きで、日常の小さな美しい瞬間を集めています。ここは、いつもの暮らしと想像の世界が出会う場所。少しのピンクと黒、そしてたくさんの想いを込めて。',
      meet: 'この言葉を書いている私のこと',
      featuredEyebrow: '心に大切にしまっている一ページ',
      featuredTitle: 'お気に入りの日記',
      allEntries: 'すべての記事',
      recentEyebrow: '日記を開いて',
      recentTitle: '新しい日記',
      topicsEyebrow: '好奇心の向くままに',
      topicsTitle: '私の世界をのぞいてみて',
      quote: '小さな想いのすべてが、世界を変える必要はない。ただ、花開く場所があればいい。',
      quoteLabel: '私の小さなノートから'
    },
    pages: {
      blog: { title: '小さな日記', description: 'いつもの日々、想像の世界、心からこぼれた言葉。記事をめくりながら、あなたの心に近いものを見つけてね。', eyebrow: '想いと物語と小さな夢' },
      about: { title: '日記を書いている私のこと', description: '空想好きな私から、あなたへ。小さな自己紹介です。', eyebrow: 'さくらみゆ' },
      writing: { title: '画面の向こうに続く物語', description: '二次創作、まだ小さな物語の種、ノートの中で育っていく想像の世界。', eyebrow: '物語を書く机' },
      archive: { title: '小さなアーカイブ', description: 'また会えるように、ここにしまった日々と夢と言葉たち。', eyebrow: 'どのページにも居場所がある' },
      tags: { title: '好きなものをつなぐ糸', description: 'タグを選んで、好奇心の向くままに歩いてみてね。', eyebrow: 'タグのコレクション' }
    },
    about: {
      heading: 'はじめまして、さくらみゆです 🌸',
      paragraphs: [
        'この小さなインターネットの片隅で、日々の暮らし、アニメ、コスプレ、ゲーム、創作、そしてときどき想像の中に生まれる物語について書いています。',
        'アニメ、ゲーム、コスプレ、日本の文化、ゴシックかわいいファッション、物語を書くこと、そして日常の小さな幸せが大好きです。ここは、現実と夢のあいだにある私の小さな世界です。',
        'もしあのキャラクターが別の選択をしていたら、物語はどう変わったのだろう。そんなことを考えるのが好きです。小さな思いつきが、いつの間にか一つの物語になることもあります。',
        '大学ではコンピューターサイエンスを学んでいます。コードと創造力が出会うところに惹かれます。コードは仕組みを理解する手助けをしてくれて、創造力は自分だけの何かを作るきっかけをくれます。',
        'ここでは、リボンの隣にセーブポイントが、そっとつづった想いの隣に物語の種が並んでいます。新しいことを学んだ日には、その一ページも残していきます。',
        '現実と夢のあいだにある、私の小さな世界へようこそ。あなたにも、どこかほっとできるものが見つかりますように。♡'
      ],
      quote: 'ある日は日記。別の日には、想像の世界へ続く扉。'
    },
    writing: {
      heading: 'もし、物語が別の道を進んでいたら？',
      intro: '物語が終わったあとも、心に残り続けるキャラクターがいます。別の選択、静かなひととき、違う始まりを想像してしまう。ここは、そんな想いをページにしていく場所です。',
      projectEyebrow: 'ノートの中で · 執筆中の二次創作',
      projectTitle: 'ルイズの、もう一つの道',
      projectDescription: '『ゼロの使い魔』のルイズに着想を得た、もう一つの物語です。違う選択をした彼女が、自分自身や周りの人たちをどのように理解していくのかを描こうとしています。',
      projectNote: '個人による非公式の二次創作です。原作のキャラクターと世界観の権利は、それぞれの権利者に帰属します。原作の台詞や本文は転載していません。',
      ideasTitle: '小さな物語の種',
      ideas: '存在しないはずの場所から届く手紙。誰か別の人の目を通して見る、なじみのある世界。結末を変えてしまう、小さな優しさ。そんなアイデアを集めるのが好きです。',
      entriesTitle: '物語のノートから'
    },
    topics: {
      diary: { title: '大切な、小さな日記へ', description: '小さな想い、いつもの日々、覚えておきたい美しいものたち。' },
      anime: { title: 'アニメがくれる小さな魔法', description: '大好きなキャラクター、何度も帰りたくなる世界、エンドロールのあとも心に残る物語。' },
      cosplay: { title: 'リボンとキャラクターとコスプレ', description: '少しの変身と創作、そして別の世界へ足を踏み入れる喜び。' },
      gaming: { title: 'セーブポイントと空想', description: 'ゲームの中の冒険、お気に入りの作品、迷い込むのが楽しい小さな世界。' }
    },
    categoryDescription: '「{name}」に集めた、小さな日々と物語。',
    categoryEyebrow: '好きなものを見つけて',
    tagTitle: '「{name}」の小さなページ',
    tagDescription: '「{name}」の糸をたどって、私の小さな世界を歩いてみてね。',
    tagEyebrow: '小さな想いを込めたタグ',
    notFound: {
      title: '少し迷子になっちゃった',
      description: 'このページは、現実と夢のあいだで迷子になってしまったみたい。一緒に帰り道を探しましょう。',
      heading: 'あれれ、この小さな夢が迷子になっちゃった！',
      eyebrow: '404 · 現実と夢のあいだの、どこかで'
    }
  }
};
