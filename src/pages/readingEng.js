// Чтение ОГЭ по английскому — №12 (matching, основное содержание) и №13–19 (один общий текст,
// 7 утверждений True/False/Not stated). В отличие от грамматики, это НЕ форма-генерация:
// тексты и вопросы — авторские (свои, не из банка), собраны в пулы модулей; генератор выбирает
// случайный модуль. Ключи-ответы заданы явно и проверены по тексту (структурная проверка ниже).
//
// Форматы:
//   READING_MODULES (№13–19): { id, title, text:[абзацы], statements:[{n:13..19, text, answer}] }
//     answer ∈ {"True","False","Not stated"} (ОГЭ-код 1/2/3 = индекс+1).
//   MATCHING_MODULES (№12): { id, intro, questions:[{n:1..7, text}], texts:[{letter, text}],
//     key:{letter→n}, extraQ } — 6 текстов A–F на 7 вопросов, один вопрос лишний (extraQ).

const pick = (a) => a[Math.floor(Math.random() * a.length)]
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] } return a }
export const TFN = ["True", "False", "Not stated"]

// ── №13–19 · пул модулей (общий текст + 7 утверждений) ───────────────────────
export const READING_MODULES = [
  {
    id: "bookshop",
    title: "The Old Bookshop",
    text: [
      "Nick had always loved reading, but he had never expected that a small bookshop would change his whole summer. The shop stood at the end of a quiet street, between a bakery and a flower shop. Its owner, an old man named Mr Blake, knew almost every book on the dusty shelves by heart.",
      "One rainy morning Nick went inside to escape the rain. Mr Blake was sitting behind the counter with a cup of tea. “Take your time,” he said kindly. “Books are patient.” Nick spent almost two hours there and left with three old adventure novels.",
      "The next week Nick returned and offered to help. He dusted the shelves, arranged the books and even served the customers when Mr Blake was tired. In return, the old man let him borrow any book he liked. By the end of August Nick had read more than twenty books.",
      "On his last visit before school started, Mr Blake gave him a small present — an old copy of Treasure Island. “Every reader should own this one,” he smiled. Nick promised to come back every weekend.",
    ],
    statements: [
      { n: 13, text: "Nick expected the bookshop to change his summer.", answer: "False" },
      { n: 14, text: "The bookshop was situated next to a bakery.", answer: "True" },
      { n: 15, text: "Mr Blake had read every book in the shop twice.", answer: "Not stated" },
      { n: 16, text: "Nick first went into the shop to get out of the rain.", answer: "True" },
      { n: 17, text: "Mr Blake paid Nick money for helping in the shop.", answer: "False" },
      { n: 18, text: "By the end of August Nick had read over twenty books.", answer: "True" },
      { n: 19, text: "Mr Blake gave Nick a copy of Treasure Island as a present.", answer: "True" },
    ],
  },
  {
    id: "violin",
    title: "Maria and the Violin",
    text: [
      "Maria was twelve when she found an old violin in her grandmother's attic. It was covered in dust and one of its strings was broken, but Maria thought it was beautiful. Her grandmother told her that the violin had belonged to Maria's great-grandfather, who had played in a small orchestra many years ago.",
      "Maria decided to learn how to play. At first the sounds she made were terrible, and her little brother often covered his ears and laughed. But Maria did not give up. She practised every day after finishing her homework.",
      "A music teacher at her school, Mrs Green, noticed how hard Maria was trying and offered to give her free lessons twice a week. Thanks to these lessons, Maria improved quickly. Within a year she was good enough to play in the school concert.",
      "On the evening of the concert Maria was very nervous, but when she saw her grandmother smiling in the front row, she felt calm. She played her great-grandfather's favourite piece, and everyone clapped loudly at the end.",
    ],
    statements: [
      { n: 13, text: "Maria found the violin in her grandmother's attic.", answer: "True" },
      { n: 14, text: "The violin was in perfect condition when Maria found it.", answer: "False" },
      { n: 15, text: "The violin had once belonged to Maria's great-grandfather.", answer: "True" },
      { n: 16, text: "Maria's brother enjoyed her playing from the very start.", answer: "False" },
      { n: 17, text: "Maria's grandmother had played the violin when she was young.", answer: "Not stated" },
      { n: 18, text: "Mrs Green gave Maria lessons three times a week.", answer: "False" },
      { n: 19, text: "Maria felt calm when she saw her grandmother at the concert.", answer: "True" },
    ],
  },
  {
    id: "swimming",
    title: "The Swimming Lesson",
    text: [
      "When Peter was ten, he was the only boy in his class who could not swim. He felt embarrassed every time his friends went to the swimming pool, so he always found an excuse to stay at home.",
      "One summer his aunt, who was a swimming teacher, came to stay with the family. She noticed that Peter never went near the water and gently asked him why. Peter admitted that he was afraid of drowning.",
      "His aunt promised to help him. Every morning they went to the quiet local pool before it got crowded. At first Peter only sat on the edge, but his aunt was patient and never laughed at him. Slowly he learnt to float, and then to move his arms and legs together.",
      "By the end of August Peter could swim the whole length of the pool. On the last day of the holiday his aunt organised a small race between Peter and his cousin. Peter did not win, but he was so proud that he had taken part. From that day on, the swimming pool became his favourite place.",
    ],
    statements: [
      { n: 13, text: "Peter was the only pupil in his class who could not swim.", answer: "True" },
      { n: 14, text: "Peter often went to the swimming pool with his friends.", answer: "False" },
      { n: 15, text: "Peter's aunt worked as a swimming teacher.", answer: "True" },
      { n: 16, text: "Peter told his aunt that he was afraid of drowning.", answer: "True" },
      { n: 17, text: "The aunt laughed at Peter during the first lessons.", answer: "False" },
      { n: 18, text: "Peter won the race against his cousin.", answer: "False" },
      { n: 19, text: "Peter's aunt had taught many other children before Peter.", answer: "Not stated" },
    ],
  },
  {
    id: "cat",
    title: "The Stray Cat",
    text: [
      "One cold November evening, Lucy found a thin grey cat sitting by her front door. It was wet and hungry, and it looked up at her with sad green eyes. Lucy could not leave it outside, so she brought it into the warm kitchen and gave it some milk.",
      "Her parents were not very happy at first. They said that a cat would be a lot of work and might damage the furniture. But Lucy promised to look after it herself, and after a few days even her father began to smile at the little animal.",
      "Lucy called the cat Misty because of its grey colour. She fed it, brushed its fur and made a cosy bed for it in a corner of her room. Misty quickly became part of the family and followed Lucy everywhere around the house.",
      "A month later Lucy put up notices in case anyone had lost the cat, but nobody ever came to claim it. Secretly, Lucy was glad. She could not imagine her life without Misty now.",
    ],
    statements: [
      { n: 13, text: "Lucy found the cat on a warm summer evening.", answer: "False" },
      { n: 14, text: "The cat looked hungry when Lucy found it.", answer: "True" },
      { n: 15, text: "Lucy's parents were delighted to have a cat straight away.", answer: "False" },
      { n: 16, text: "Lucy promised to take care of the cat herself.", answer: "True" },
      { n: 17, text: "The cat was given the name Misty because of its colour.", answer: "True" },
      { n: 18, text: "Misty was afraid of Lucy's father.", answer: "Not stated" },
      { n: 19, text: "Someone came to take the cat back.", answer: "False" },
    ],
  },
  {
    id: "bread",
    title: "Grandmother's Recipe",
    text: [
      "Sofia loved spending her summer holidays at her grandmother's house in the village. The best part of every visit was the smell of fresh bread that filled the kitchen each morning. Her grandmother baked bread using a recipe that had been in the family for over a hundred years.",
      "One summer Sofia decided that she wanted to learn the secret. Her grandmother was happy to teach her, but she warned Sofia that good bread takes time and patience. Together they mixed the flour, added the other ingredients and waited for the dough to rise.",
      "Sofia's first attempts were not very successful. Once the bread was too hard, and another time it did not rise at all. She felt like giving up, but her grandmother encouraged her to try again.",
      "By the end of the holiday Sofia baked a loaf that looked and tasted almost as good as her grandmother's. When she returned to the city, she brought the recipe with her and promised to bake bread for her parents every Sunday.",
    ],
    statements: [
      { n: 13, text: "Sofia spent her summer holidays at her grandmother's house.", answer: "True" },
      { n: 14, text: "Sofia disliked the smell of fresh bread in the kitchen.", answer: "False" },
      { n: 15, text: "The bread recipe was more than a hundred years old.", answer: "True" },
      { n: 16, text: "Sofia's grandmother refused to share the recipe.", answer: "False" },
      { n: 17, text: "All of Sofia's first loaves came out perfectly.", answer: "False" },
      { n: 18, text: "Sofia's grandmother sold her bread at the village market.", answer: "Not stated" },
      { n: 19, text: "Sofia took the recipe back to the city with her.", answer: "True" },
    ],
  },
  {
    id: "wallet",
    title: "The Lost Wallet",
    text: [
      "On his way home from school, Max found a brown wallet lying on the pavement. Inside there was some money, a bus pass and a photograph of a smiling family. Max knew at once that he had to return it to its owner.",
      "There was no address in the wallet, but the bus pass had a name on it: Mr Robert Hill. Max decided to ask at the local library, where the librarian knew almost everyone in the small town. She recognised the name immediately and told Max the street where Mr Hill lived.",
      "When Max knocked on the door, an old man opened it. He had been looking for his wallet all afternoon and was very worried, because the photograph inside was the only picture he had of his late wife. He thanked Max warmly and offered him a reward.",
      "Max refused to take any money. He said that helping someone was reward enough. The old man smiled and said that there were still kind people in the world.",
    ],
    statements: [
      { n: 13, text: "Max found the wallet on his way to school.", answer: "False" },
      { n: 14, text: "There was a photograph inside the wallet.", answer: "True" },
      { n: 15, text: "The wallet contained the owner's home address.", answer: "False" },
      { n: 16, text: "The librarian knew where Mr Hill lived.", answer: "True" },
      { n: 17, text: "Mr Hill was upset mostly because of the photograph.", answer: "True" },
      { n: 18, text: "Max accepted a reward from Mr Hill.", answer: "False" },
      { n: 19, text: "Mr Hill lived together with his grandchildren.", answer: "Not stated" },
    ],
  },
  {
    id: "newschool",
    title: "The New School",
    text: [
      "When Dima's family moved to a new city, he was nervous about starting at a different school. He was afraid that he would not make any friends and that the lessons would be too difficult.",
      "On his first day, a boy named Anton showed him around the building and introduced him to the class. Everyone was friendly, and by lunchtime Dima already felt more relaxed. The teachers were kind and explained that he could ask for help whenever he needed it.",
      "During the first week Dima discovered that his new school had a football team. He had played football at his old school, so he decided to join. At the first training session he scored a goal, and the other players were happy to have him on the team.",
      "By the end of the month Dima could hardly believe how worried he had been. He had made several good friends and even liked his new school better than the old one.",
    ],
    statements: [
      { n: 13, text: "Dima was nervous about starting at a new school.", answer: "True" },
      { n: 14, text: "Dima was sure he would make friends quickly.", answer: "False" },
      { n: 15, text: "A boy called Anton helped Dima on his first day.", answer: "True" },
      { n: 16, text: "The teachers refused to help new students.", answer: "False" },
      { n: 17, text: "Dima had never played football before.", answer: "False" },
      { n: 18, text: "Dima scored a goal at his first training session.", answer: "True" },
      { n: 19, text: "Dima's new school was bigger than his old one.", answer: "Not stated" },
    ],
  },
  {
    id: "talent",
    title: "The Talent Show",
    text: [
      "Every spring the school held a talent show, and this year Katya decided to take part. She had been learning to play the guitar for two years and wanted to perform a song in front of the whole school.",
      "As the day approached, Katya practised for hours every evening. Her older brother, who played in a band, gave her useful advice about how to stay calm on stage. Still, Katya felt more and more nervous.",
      "On the evening of the show, the hall was full of students, teachers and parents. When Katya's turn came, her hands were shaking, but as soon as she began to play, she forgot her fear. The audience listened quietly and then clapped loudly when she finished.",
      "Katya did not win the first prize, but many people came up to tell her how much they had enjoyed her song. She felt proud of herself for being brave enough to perform.",
    ],
    statements: [
      { n: 13, text: "The school talent show took place every spring.", answer: "True" },
      { n: 14, text: "Katya had been playing the guitar for two years.", answer: "True" },
      { n: 15, text: "Katya's brother discouraged her from taking part.", answer: "False" },
      { n: 16, text: "Katya felt calm as the day of the show approached.", answer: "False" },
      { n: 17, text: "Katya forgot her fear once she started playing.", answer: "True" },
      { n: 18, text: "Katya won the first prize at the show.", answer: "False" },
      { n: 19, text: "Katya had taken part in the talent show in previous years.", answer: "Not stated" },
    ],
  },
  {
    id: "camping",
    title: "The Camping Trip",
    text: [
      "Last summer Oleg went on his first camping trip with his father. They drove to a forest near a lake and put up their tent among the tall pine trees. Oleg had never slept outdoors before and was very excited.",
      "On the first evening they made a fire and cooked sausages. Oleg's father showed him how to find dry wood and light the fire safely. Later they sat under the stars, and his father told stories about his own childhood adventures.",
      "During the night it started to rain heavily. Water began to come into the tent, and Oleg felt cold and uncomfortable. His father calmed him down, and in the morning the sun came out and dried everything.",
      "Despite the rain, Oleg had a wonderful time. He learnt how to fish, how to read a map and how to look after himself in the wild. He could not wait to go camping again the following summer.",
    ],
    statements: [
      { n: 13, text: "It was Oleg's first camping trip.", answer: "True" },
      { n: 14, text: "They camped in a forest near a lake.", answer: "True" },
      { n: 15, text: "Oleg had often slept outdoors before.", answer: "False" },
      { n: 16, text: "Oleg's father taught him how to light a fire safely.", answer: "True" },
      { n: 17, text: "It stayed dry throughout the whole night.", answer: "False" },
      { n: 18, text: "Oleg caught a very big fish during the trip.", answer: "Not stated" },
      { n: 19, text: "Oleg wanted to go camping again the next summer.", answer: "True" },
    ],
  },
  {
    id: "volcano",
    title: "The Science Project",
    text: [
      "For the school science fair, Nina wanted to build something really impressive. After thinking for a long time, she decided to make a small model of a volcano that could actually erupt.",
      "She spent two weekends working on the project. First she made the shape of the mountain out of paper and glue, and then she painted it brown and green. Her mother, who was a chemistry teacher, helped her prepare a safe mixture that would create the eruption.",
      "On the day of the fair, Nina was worried that her volcano would not work in front of everyone. But when she poured in the special liquid, red foam rushed out of the top just like real lava. The other students cheered.",
      "The judges were impressed by how much effort Nina had put into her project. She won second place and received a book about famous scientists. Nina was already planning an even better project for next year.",
    ],
    statements: [
      { n: 13, text: "Nina decided to build a model volcano.", answer: "True" },
      { n: 14, text: "Nina finished the project in a single day.", answer: "False" },
      { n: 15, text: "Nina's mother was a chemistry teacher.", answer: "True" },
      { n: 16, text: "The volcano failed to work at the fair.", answer: "False" },
      { n: 17, text: "Nina won first place at the science fair.", answer: "False" },
      { n: 18, text: "Nina received a book as a prize.", answer: "True" },
      { n: 19, text: "Nina's project was the most popular at the fair.", answer: "Not stated" },
    ],
  },
  {
    id: "piano",
    title: "The Old Piano",
    text: [
      "When the Petrovs moved into their new flat, they found an old piano left behind by the previous owners. It was dusty and slightly out of tune, but eleven-year-old Vera loved it at first sight.",
      "Vera had always wanted to learn to play, so her parents arranged for a teacher to come once a week. At first Vera found it difficult, and her fingers often hit the wrong keys. Her younger brother teased her about the strange sounds coming from the living room.",
      "But Vera was determined. She practised every day, even when she was tired after school. Little by little, the strange sounds turned into real melodies, and soon she could play several simple pieces from memory.",
      "A year later Vera played at a small concert in her music school. Her parents and even her brother were proud of her. Her brother admitted that the old piano had turned out to be the best thing they found in the new flat.",
    ],
    statements: [
      { n: 13, text: "The Petrovs found the old piano in their new flat.", answer: "True" },
      { n: 14, text: "The piano was in perfect tune when they found it.", answer: "False" },
      { n: 15, text: "Vera had always wanted to learn to play the piano.", answer: "True" },
      { n: 16, text: "Vera's brother praised her playing from the very beginning.", answer: "False" },
      { n: 17, text: "Vera's parents also knew how to play the piano.", answer: "Not stated" },
      { n: 18, text: "Vera played at a concert a year later.", answer: "True" },
      { n: 19, text: "Vera's teacher came to their flat twice a week.", answer: "False" },
    ],
  },
]

// ── №12 · пул matching-заданий (6 текстов A–F, 7 вопросов, один лишний) ───────
const MATCH_INTRO =
  "Установите соответствие между текстами A–F и вопросами 1–7. Занесите свои ответы в таблицу. " +
  "Используйте каждую цифру только один раз. В задании один вопрос лишний."
export const MATCHING_MODULES = [
  {
    id: "places",
    intro: MATCH_INTRO,
    questions: [
      { n: 1, text: "Where can you see animals that live nowhere else?" },
      { n: 2, text: "Which place is popular with people who love mountains?" },
      { n: 3, text: "Where can visitors learn about the history of trains?" },
      { n: 4, text: "Which place is best for people who enjoy quiet reading?" },
      { n: 5, text: "Where can you taste food from many countries?" },
      { n: 6, text: "Which place is famous for its beautiful gardens?" },
      { n: 7, text: "Where can families spend a whole day with children?" },
    ],
    texts: [
      { letter: "A", text: "Sunny Park is a huge green area just outside the city. There are playgrounds, a small petting zoo and a boating lake. Parents can relax on the grass while their children ride bikes or feed the ducks. Many families bring a picnic and stay here from morning till evening." },
      { letter: "B", text: "The Old Station Museum tells the story of the railway. Visitors can climb into steam engines built a hundred years ago, look at old tickets and uniforms, and watch short films about how the first trains changed the way people travelled." },
      { letter: "C", text: "Greenhill is famous all over the region for its gardens. In spring thousands of tulips turn the slopes into a sea of colour, and in summer the roses fill the air with a sweet smell. Photographers travel from far away just to capture the flowers." },
      { letter: "D", text: "The Riverside Market is a paradise for hungry visitors. Small stalls sell dishes from all over the world — Italian pizza, Indian curry, Japanese sushi and much more. You can travel around the globe with your fork without ever leaving the city." },
      { letter: "E", text: "The Town Library is a calm and peaceful place. Its reading rooms are always silent, and soft armchairs stand near the tall windows. People come here to read for hours, enjoying the quiet and never being disturbed by noise." },
      { letter: "F", text: "Wild Island is home to birds and lizards that cannot be found anywhere else on Earth. Scientists come to study these rare creatures, and careful visitors can watch them in their natural home from special wooden paths above the ground." },
    ],
    key: { A: 7, B: 3, C: 6, D: 5, E: 4, F: 1 },
    extraQ: 2,
  },
  {
    id: "hobbies",
    intro: MATCH_INTRO,
    questions: [
      { n: 1, text: "Who turned a hobby into a way of earning money?" },
      { n: 2, text: "Who has a hobby that helps them stay fit?" },
      { n: 3, text: "Who enjoys a hobby they can do quietly alone at home?" },
      { n: 4, text: "Who started a hobby because of a family member?" },
      { n: 5, text: "Who collects things from many different countries?" },
      { n: 6, text: "Who shares their hobby with a large online audience?" },
      { n: 7, text: "Who spends a lot of money on their hobby?" },
    ],
    texts: [
      { letter: "A", text: "I took up cycling three years ago. Every weekend I ride for hours in the countryside. It keeps me healthy and strong, and I have never felt better. I don't compete — I just love being active in the fresh air." },
      { letter: "B", text: "My grandfather was a keen fisherman, and he taught me everything when I was little. Now fishing is my favourite pastime. Whenever I hold the rod, I remember our quiet mornings by the river together." },
      { letter: "C", text: "I make short videos about drawing cartoons and post them online. Thousands of people watch my channel and leave comments. It is amazing to share what I love with so many viewers around the world." },
      { letter: "D", text: "I started baking cakes just for fun, but my friends loved them so much that I began selling them. Now I earn quite a good sum every month, and my little hobby has almost become a real business." },
      { letter: "E", text: "I have been collecting fridge magnets for years. Every time a friend travels abroad, they bring me one. My kitchen is now covered with magnets from dozens of different countries, and each one tells a story." },
      { letter: "F", text: "Knitting is the perfect hobby for me. I can sit quietly at home in the evenings, making scarves and hats. I don't need anyone else — just my wool, my needles and a warm cup of tea." },
    ],
    key: { A: 2, B: 4, C: 6, D: 1, E: 5, F: 3 },
    extraQ: 7,
  },
  {
    id: "school",
    intro: MATCH_INTRO,
    questions: [
      { n: 1, text: "Which subject helps students understand the past?" },
      { n: 2, text: "Which club is good for students who like working with numbers?" },
      { n: 3, text: "Where can students practise speaking a foreign language?" },
      { n: 4, text: "What helps students who find it hard to concentrate?" },
      { n: 5, text: "Which club is best for students who love the stage?" },
      { n: 6, text: "What does the school offer to keep students fit?" },
      { n: 7, text: "Where is a good place for quiet individual study?" },
    ],
    texts: [
      { letter: "A", text: "The Language Club meets twice a week after lessons. Students chat only in English, play word games and sometimes invite guests from other countries. It is the best way to practise speaking without feeling shy." },
      { letter: "B", text: "Our Drama Club puts on two plays every year. Members learn their lines, make costumes and act on the big school stage in front of hundreds of parents. It is perfect for anyone who dreams of becoming an actor." },
      { letter: "C", text: "History lessons take students on a journey through time. They learn about ancient kings, great battles and how ordinary people lived hundreds of years ago. Understanding the past helps us make sense of today." },
      { letter: "D", text: "The school offers morning exercises before the first lesson. A short run and some stretching wake students up and keep them fit. Teachers say that pupils who move in the morning work better in class." },
      { letter: "E", text: "The school library is open all day. Its silent reading area has soft chairs and big desks where students can study on their own, far from any noise, and prepare for their exams in peace." },
      { letter: "F", text: "The Maths Olympiad Club is ideal for students who enjoy solving tricky problems with numbers. Members train for competitions, learn clever tricks and often win prizes at regional contests." },
    ],
    key: { A: 3, B: 5, C: 1, D: 6, E: 7, F: 2 },
    extraQ: 4,
  },
  {
    id: "health",
    intro: MATCH_INTRO,
    questions: [
      { n: 1, text: "What helps you sleep better at night?" },
      { n: 2, text: "Which food gives you energy for the whole morning?" },
      { n: 3, text: "What is a cheap and easy way to keep fit?" },
      { n: 4, text: "Why is drinking enough water important?" },
      { n: 5, text: "How can you protect your eyes when using gadgets?" },
      { n: 6, text: "What is a good way to relax and lift your mood?" },
      { n: 7, text: "Why should you spend time outdoors?" },
    ],
    texts: [
      { letter: "A", text: "Walking is one of the simplest ways to stay fit. You don't need any special equipment or a gym membership — just a comfortable pair of shoes. A brisk half-hour walk every day keeps your heart strong." },
      { letter: "B", text: "Never skip breakfast. A bowl of porridge with fruit gives your body the energy it needs for the whole morning. Students who eat a good breakfast find it much easier to concentrate in class." },
      { letter: "C", text: "If you spend hours in front of a screen, remember your eyes. Every twenty minutes, look away at something far off for a short while. This simple habit prevents tired eyes and bad headaches." },
      { letter: "D", text: "Spending time outdoors is good for both body and mind. Fresh air and natural light improve your mood and help your body produce vitamin D. Try to go outside for at least an hour every day." },
      { letter: "E", text: "Our bodies are mostly made of water, so we must drink enough of it. Water helps you think clearly, keeps your skin healthy and gives you energy. Doctors advise drinking several glasses a day." },
      { letter: "F", text: "Listening to your favourite music is a wonderful way to relax after a hard day. It can lift your mood, reduce stress and even help you forget your worries for a little while." },
    ],
    key: { A: 3, B: 2, C: 5, D: 7, E: 4, F: 6 },
    extraQ: 1,
  },
  {
    id: "jobs",
    intro: MATCH_INTRO,
    questions: [
      { n: 1, text: "Who helps people when they are ill?" },
      { n: 2, text: "Who teaches children at school?" },
      { n: 3, text: "Who puts out fires and rescues people?" },
      { n: 4, text: "Who cooks meals in a restaurant?" },
      { n: 5, text: "Who designs new buildings?" },
      { n: 6, text: "Who takes care of sick animals?" },
      { n: 7, text: "Who flies planes?" },
    ],
    texts: [
      { letter: "A", text: "I spend my days looking after sick cats, dogs and other animals. When a pet is hurt or unwell, worried owners bring it to me, and I do my best to make it better. I love working with animals." },
      { letter: "B", text: "Every morning I stand in front of a class of thirty children. I help them learn to read, write and count, and I try to make my lessons interesting. Watching my pupils grow cleverer is the best reward." },
      { letter: "C", text: "I work in the kitchen of a busy restaurant. I prepare soups, main courses and desserts for hundreds of guests every evening. The work is hot and tiring, but I am proud when people enjoy my dishes." },
      { letter: "D", text: "When the alarm rings, I put on my heavy uniform and rush to the fire engine. My job is dangerous — I put out fires and rescue people from burning buildings — but I am glad to keep my town safe." },
      { letter: "E", text: "People come to me when they feel unwell. I listen to their problems, examine them and decide how to treat their illness. Sometimes I give them medicine, and sometimes I just tell them to rest." },
      { letter: "F", text: "I design houses, offices and bridges. I draw detailed plans on my computer and work closely with builders to make sure everything is safe and beautiful. It is wonderful to see my ideas become real buildings." },
    ],
    key: { A: 6, B: 2, C: 4, D: 3, E: 1, F: 5 },
    extraQ: 7,
  },
  {
    id: "countries",
    intro: MATCH_INTRO,
    questions: [
      { n: 1, text: "Which country is famous for its ancient pyramids?" },
      { n: 2, text: "Where can tourists see kangaroos in the wild?" },
      { n: 3, text: "Which city is known for its canals and gondolas?" },
      { n: 4, text: "Where can climbers try to reach the highest mountain on Earth?" },
      { n: 5, text: "Which country is famous for pizza and pasta?" },
      { n: 6, text: "Where can you watch the Northern Lights?" },
      { n: 7, text: "Which country is known for its tea ceremonies?" },
    ],
    texts: [
      { letter: "A", text: "This beautiful Italian city has no ordinary streets. Instead, people travel along narrow canals in long boats called gondolas. Tourists love taking a slow boat ride past the old palaces and bridges." },
      { letter: "B", text: "This huge country is home to many unusual animals. In its wide open spaces, visitors can see kangaroos jumping across the fields and koalas sleeping in the trees. Nowhere else has such strange wildlife." },
      { letter: "C", text: "Thousands of years ago, people in this African country built enormous stone pyramids as tombs for their kings. Today millions of tourists come to admire these ancient wonders and to learn about the past." },
      { letter: "D", text: "This sunny European country is loved by food lovers all over the world. It is the home of delicious pizza and countless kinds of pasta. Every region has its own special dishes and traditions." },
      { letter: "E", text: "Far in the north, on clear winter nights, the sky here fills with dancing green and purple lights. People travel from all over the world to watch this magical natural show above the snow." },
      { letter: "F", text: "This small mountainous country attracts brave climbers from everywhere. It is home to the highest mountain on Earth, and every year adventurers come to try to reach its snowy peak." },
    ],
    key: { A: 3, B: 2, C: 1, D: 5, E: 6, F: 4 },
    extraQ: 7,
  },
  {
    id: "gadgets",
    intro: MATCH_INTRO,
    questions: [
      { n: 1, text: "Which device helps you find your way in an unfamiliar city?" },
      { n: 2, text: "What can you use to read hundreds of books on one small screen?" },
      { n: 3, text: "Which technology lets you see and talk to friends far away?" },
      { n: 4, text: "What helps you wake up on time in the morning?" },
      { n: 5, text: "Which machine keeps your food cold and fresh?" },
      { n: 6, text: "What can you use to take photos and share them instantly?" },
      { n: 7, text: "Which machine washes your clothes for you?" },
    ],
    texts: [
      { letter: "A", text: "This thin, light device can store thousands of books at once. Instead of carrying heavy volumes, readers simply tap the screen to turn the page. It is perfect for people who love reading while travelling." },
      { letter: "B", text: "Never get lost again. This clever gadget uses satellites to show you exactly where you are and how to reach your destination. Drivers and tourists rely on it in unfamiliar streets and towns." },
      { letter: "C", text: "With this device in your pocket, you can capture any moment in a second and send the picture to your friends immediately. Millions of photos are shared around the world every single minute." },
      { letter: "D", text: "This large kitchen machine keeps your milk, meat and vegetables cold. Thanks to it, food stays fresh for much longer, and families can store enough for the whole week." },
      { letter: "E", text: "Even when your friends live in another country, you can see their faces and talk to them in real time. This technology has made long distances feel much smaller." },
      { letter: "F", text: "This small but important device makes sure you don't oversleep. You set the time before going to bed, and in the morning it rings loudly until you finally get up." },
    ],
    key: { A: 2, B: 1, C: 6, D: 5, E: 3, F: 4 },
    extraQ: 7,
  },
  {
    id: "animals",
    intro: MATCH_INTRO,
    questions: [
      { n: 1, text: "Which animal is the largest that lives on land?" },
      { n: 2, text: "Which animal can change the colour of its skin?" },
      { n: 3, text: "Which bird cannot fly but swims very well?" },
      { n: 4, text: "Which animal is often called man's best friend?" },
      { n: 5, text: "Which insect makes honey?" },
      { n: 6, text: "Which animal sleeps hanging upside down?" },
      { n: 7, text: "Which animal is the fastest runner?" },
    ],
    texts: [
      { letter: "A", text: "This small striped insect visits thousands of flowers every day. It collects a sweet liquid and turns it into honey, which people all over the world love to eat. Without it, many plants could not grow." },
      { letter: "B", text: "This enormous grey animal is the biggest that lives on land. It has huge ears, a long trunk and tusks. Despite its size, it is gentle and lives in family groups led by the oldest female." },
      { letter: "C", text: "This black-and-white bird lives in cold places and cannot fly at all. However, in the water it is an excellent swimmer, using its wings like flippers to catch fish." },
      { letter: "D", text: "This is the only mammal that can truly fly. During the day it hangs upside down in caves and trees to sleep, and at night it comes out to hunt insects in the dark." },
      { letter: "E", text: "For thousands of years this loyal animal has lived beside people. It guards our homes, helps us work and keeps us company. Many people call it man's best friend." },
      { letter: "F", text: "This unusual lizard has a special ability: it can change the colour of its skin to match its surroundings. This clever trick helps it hide from enemies and catch insects." },
    ],
    key: { A: 5, B: 1, C: 3, D: 6, E: 4, F: 2 },
    extraQ: 7,
  },
  {
    id: "books",
    intro: MATCH_INTRO,
    questions: [
      { n: 1, text: "Who prefers reading exciting adventure stories?" },
      { n: 2, text: "Who enjoys reading about real historical events?" },
      { n: 3, text: "Who likes funny books that make them laugh?" },
      { n: 4, text: "Who reads mainly to learn something useful?" },
      { n: 5, text: "Who prefers listening to audiobooks?" },
      { n: 6, text: "Who enjoys scary stories?" },
      { n: 7, text: "Who loves reading poetry?" },
    ],
    texts: [
      { letter: "A", text: "I don't read for fun — I read to learn. I love books that teach me how things work, how to cook new dishes or how to fix things around the house. A good book should be useful." },
      { letter: "B", text: "Give me a story full of danger, treasure and brave heroes, and I am happy. I love adventures on desert islands and journeys to unknown lands. I can read such books for hours without stopping." },
      { letter: "C", text: "I spend a lot of time travelling by bus, so instead of reading with my eyes, I listen. I download audiobooks and enjoy a good story through my headphones while I look out of the window." },
      { letter: "D", text: "I am fascinated by the past. My favourite books tell the true stories of kings, wars and great discoveries. Reading about real events helps me understand how our world came to be." },
      { letter: "E", text: "I love the feeling of being a little frightened. My favourite books are full of dark old houses, strange noises and mysteries. The scarier the story, the more I enjoy it, especially late at night." },
      { letter: "F", text: "Life is serious enough, so I like books that make me laugh out loud. Funny characters and silly situations always cheer me up. A good comedy is the best way to relax after school." },
    ],
    key: { A: 4, B: 1, C: 5, D: 2, E: 6, F: 3 },
    extraQ: 7,
  },
  {
    id: "weekend",
    intro: MATCH_INTRO,
    questions: [
      { n: 1, text: "Who spends the weekend helping their family?" },
      { n: 2, text: "Who likes to relax quietly at home?" },
      { n: 3, text: "Who enjoys playing sports at the weekend?" },
      { n: 4, text: "Who uses the weekend to meet friends?" },
      { n: 5, text: "Who prefers spending weekends out in nature?" },
      { n: 6, text: "Who does creative things at the weekend?" },
      { n: 7, text: "Who has to work at the weekend?" },
    ],
    texts: [
      { letter: "A", text: "At the weekend I love to escape the noisy city. My family and I drive to the forest or the river, where we walk, breathe the fresh air and sometimes have a picnic. Nature is the best place to rest." },
      { letter: "B", text: "For me the weekend means sport. On Saturdays I play basketball with my team, and on Sundays I go swimming. Being active makes me feel full of energy for the whole week ahead." },
      { letter: "C", text: "I spend my weekends drawing and painting. I set up my paints on the kitchen table and create pictures of everything I see. Sometimes I make cards and small presents for my friends." },
      { letter: "D", text: "My weekends are busy but happy. I help my parents with the shopping, clean the house and look after my little sister. My grandmother says I am a real helper, and that makes me proud." },
      { letter: "E", text: "After a hard week at school, I just want to stay at home and relax. I watch films, read my favourite books and sleep a little longer than usual. A quiet weekend is exactly what I need." },
      { letter: "F", text: "The best part of the weekend is meeting my friends. We go to the cinema, walk in the park or just sit in a cafe and chat for hours. I always feel happier after spending time with them." },
    ],
    key: { A: 5, B: 3, C: 6, D: 1, E: 2, F: 4 },
    extraQ: 7,
  },
]

// ── №12 · КОМБИНАТОРНЫЙ генератор ─────────────────────────────────────────────
// Каждая тема — БАНК пар { q: вопрос, t: текст-ответ } (много пар) + «лишние» вопросы
// (distractors — вопросы той же темы, у которых НЕТ текста-ответа в банке). Генератор берёт
// 6 случайных пар + 1 лишний вопрос, перемешивает порядок текстов (буквы A–F) и порядок
// вопросов (номера 1–7) → из одной темы получаются тысячи уникальных наборов. Каждая пара
// текст→вопрос выверена вручную один раз, поэтому ответы остаются корректными.

// фиксированный набор №12 → банк пар (переиспользуем уже написанные тексты)
function moduleToBank(m) {
  const qByN = new Map(m.questions.map((q) => [q.n, q.text]))
  return { id: m.id, items: m.texts.map((t) => ({ q: qByN.get(m.key[t.letter]), t: t.text })) }
}

// Доп. пары к каждой теме (расширяют банк → больше комбинаций). Пополняется партиями.
const EXTRA_ITEMS = {
  places: [
    { q: "Which place is popular with people who love mountains?", t: "Eagle Peak attracts hikers and climbers all year round. Its steep paths and fresh air draw those who love a real challenge and beautiful views." },
    { q: "Where can visitors see famous paintings?", t: "The City Art Gallery holds hundreds of works by great masters. Visitors move quietly from room to room, admiring pictures that are centuries old." },
    { q: "Where is a good place to watch new films?", t: "The Star Cinema shows the latest films every day on a huge screen, and its soft seats make it the favourite evening spot for local teenagers." },
  ],
  hobbies: [
    { q: "Who has a hobby connected with growing plants?", t: "I love gardening. Every spring I plant flowers and vegetables on my balcony, and watching them grow slowly gives me real pleasure." },
    { q: "Who enjoys a hobby that needs cold, snowy weather?", t: "My passion is skiing. As soon as the first snow falls, I head to the mountains and spend every free day I can on the slopes." },
    { q: "Who has taken up a musical instrument?", t: "I have been playing the drums for five years now. I practise in the garage so that I don't disturb the neighbours too much." },
  ],
  school: [
    { q: "Which club is good for students who love experiments?", t: "The Science Club lets students carry out safe experiments with water, light and simple chemicals, discovering how the world around them works." },
    { q: "Where can students borrow musical instruments for free?", t: "The Music Room lends guitars, violins and keyboards to any pupil who wants to learn to play, and it does not cost anything." },
    { q: "What is organised to help students who are new to the school?", t: "Older pupils act as guides for newcomers, showing them around the building and helping them settle in during the first difficult weeks." },
  ],
  health: [
    { q: "What helps keep your teeth healthy?", t: "Brushing your teeth twice a day and eating less sugar keeps your smile bright and helps you avoid painful visits to the dentist." },
    { q: "Why should you warm up before doing sport?", t: "A few minutes of gentle stretching before exercise prepares your muscles for the effort and helps you avoid painful injuries." },
    { q: "How can you avoid catching colds in winter?", t: "Washing your hands often and dressing warmly when you go outside are two simple ways to stay free of coughs and colds." },
  ],
  jobs: [
    { q: "Who flies planes full of passengers?", t: "I sit in the cockpit high above the clouds. My job is to fly hundreds of passengers safely from one city to another, whatever the weather." },
    { q: "Who delivers letters and parcels to homes?", t: "Every morning I fill my heavy bag with letters and walk from house to house, making sure that everyone gets their post on time." },
    { q: "Who cuts and styles people's hair?", t: "People come to my chair to look their best. I wash, cut and style their hair, and we chat happily about everything while I work." },
  ],
  countries: [
    { q: "Which country is known for its tea ceremonies?", t: "In this Asian country, preparing and serving tea is a graceful art with hundreds of years of tradition and very strict rules behind it." },
    { q: "Which country is famous for a tall iron tower in its capital?", t: "Millions of tourists visit this European country each year to admire its famous iron tower and to stroll along the river in its lovely capital." },
    { q: "Where can visitors go on a safari to see wild lions?", t: "On the vast, sunny plains of this region, visitors ride in open jeeps to watch lions, elephants and zebras living freely in the wild." },
  ],
  gadgets: [
    { q: "Which machine washes your clothes for you?", t: "You simply put in your dirty clothes, add some powder and press a button; this machine then does all the hard work of washing for you." },
    { q: "What keeps your home warm in winter?", t: "When it gets cold outside, this device fills the rooms with heat so that the whole family stays cosy and comfortable indoors." },
    { q: "What can you use to listen to music anywhere?", t: "These small wireless earphones let you enjoy your favourite songs on the bus, in the park or while walking to school, without any cables." },
  ],
  animals: [
    { q: "Which animal is the fastest runner on land?", t: "This spotted big cat can run faster than any other animal on land, reaching an amazing speed in just a few seconds as it chases its prey." },
    { q: "Which sea animal is famous for being clever and playful?", t: "These friendly grey sea mammals are famous for their intelligence. They play together, help one another and can even learn simple tricks." },
    { q: "Which small animal carries its home on its back?", t: "This slow little creature moves along the ground carrying a hard shell, into which it quickly hides whenever it senses any danger." },
  ],
  books: [
    { q: "Who loves reading poetry?", t: "For me, nothing is better than a beautiful poem. I enjoy the rhythm of the words and often learn my favourite verses by heart." },
    { q: "Who enjoys reading comics?", t: "I love comics. The bright pictures and the short lines of speech make every story exciting and very easy to follow." },
    { q: "Who prefers reading about science and nature?", t: "My favourite books explain how animals live, how stars are born and why the sky is blue. I really want to understand everything around me." },
  ],
  weekend: [
    { q: "Who has a job at the weekend?", t: "Unlike most of my friends, I have a Saturday job in a small shop. I earn my own pocket money, although I do miss sleeping late." },
    { q: "Who spends the weekend playing computer games?", t: "On Saturdays I meet my online friends and we play games together for hours. It is exciting, and we plan our matches all week long." },
    { q: "Who enjoys baking at the weekend?", t: "Every Sunday I bake something new — cookies, muffins or a big cake. The kitchen smells wonderful and my whole family loves the results." },
  ],
}

// «Лишние» вопросы: правдоподобны для темы, но НЕ имеют текста-ответа в банке.
const DISTRACTORS = {
  places: ["Where can tourists stay overnight cheaply?", "Where can you buy fresh vegetables?"],
  hobbies: ["Who recently gave up their hobby?", "Who earns a living from their hobby?"],
  school: ["Which club is the most expensive to join?", "What do most students dislike about school?"],
  health: ["Why do some people visit the doctor every week?", "What is the most dangerous sport of all?"],
  jobs: ["Who works only during the night?", "Who earns the highest salary?"],
  countries: ["Which country has the largest population?", "Where is it winter all year round?"],
  gadgets: ["Which gadget is the most expensive to buy?", "Which device was invented most recently?"],
  animals: ["Which animal lives the longest?", "Which animal is the most dangerous to people?"],
  books: ["Who reads only while on holiday?", "Who has written a book of their own?"],
  weekend: ["Who never has any free time at the weekend?", "Who travels abroad every weekend?"],
}

// собрать банки: пары фиксированного набора + доп. пары + «лишние» вопросы
const MATCHING_BANKS = MATCHING_MODULES.map((m) => {
  const base = moduleToBank(m)
  return { id: base.id, items: [...base.items, ...(EXTRA_ITEMS[base.id] || [])], distractors: DISTRACTORS[base.id] || [] }
})
const LETTERS = ["A", "B", "C", "D", "E", "F"]

// собрать один набор №12 из банка: 6 случайных пар + 1 лишний вопрос, перемешать порядок
function assembleMatching(bank) {
  const chosen = shuffle(bank.items).slice(0, 6)
  const distractor = pick(bank.distractors)
  const qTexts = shuffle([...chosen.map((i) => i.q), distractor])   // 7 вопросов, случайный порядок
  const qNum = new Map(qTexts.map((text, idx) => [text, idx + 1]))
  const questions = qTexts.map((text, idx) => ({ n: idx + 1, text }))
  const ordered = shuffle(chosen)                                    // случайное назначение букв A–F
  const texts = ordered.map((it, idx) => ({ letter: LETTERS[idx], text: it.t }))
  const key = {}
  ordered.forEach((it, idx) => { key[LETTERS[idx]] = qNum.get(it.q) })
  return { id: bank.id, intro: MATCH_INTRO, questions, texts, key, extraQ: qNum.get(distractor) }
}

export function genReadingModule() { return pick(READING_MODULES) }
export function genMatchingModule() { return assembleMatching(pick(MATCHING_BANKS)) }

// ── Структурная самопроверка (падает при импорте, если данные битые) ──────────
function checkReading() {
  const errs = []
  for (const m of READING_MODULES) {
    const nums = m.statements.map((s) => s.n)
    if (nums.join() !== "13,14,15,16,17,18,19") errs.push(`${m.id}: номера утверждений ${nums}`)
    for (const s of m.statements) if (!TFN.includes(s.answer)) errs.push(`${m.id}/${s.n}: ответ «${s.answer}»`)
    if (!m.text.length) errs.push(`${m.id}: пустой текст`)
  }
  for (const b of MATCHING_BANKS) {
    if (b.items.length < 7) errs.push(`${b.id}: пар ${b.items.length} < 7 (мало для 6+перемешивание)`)
    if (!b.distractors.length) errs.push(`${b.id}: нет «лишних» вопросов`)
    const itemQs = new Set(b.items.map((i) => i.q))
    for (const q of itemQs) if (!q) errs.push(`${b.id}: пустой вопрос в паре`)
    if (new Set(b.items.map((i) => i.t)).size !== b.items.length) errs.push(`${b.id}: повтор текста в банке`)
    // «лишний» вопрос не должен иметь текста-ответа среди пар (иначе он не лишний)
    for (const d of b.distractors) if (itemQs.has(d)) errs.push(`${b.id}: лишний вопрос совпал с парой: «${d}»`)
  }
  // собранный набор должен быть структурно валиден (7 вопросов, 6 текстов, ключ уникален, лишний вне ключа)
  for (const b of MATCHING_BANKS) {
    for (let i = 0; i < 20; i++) {
      const s = assembleMatching(b)
      if (s.questions.length !== 7) { errs.push(`${b.id}: собрано вопросов ≠7`); break }
      if (s.texts.length !== 6) { errs.push(`${b.id}: собрано текстов ≠6`); break }
      const used = Object.values(s.key)
      if (new Set(used).size !== 6) { errs.push(`${b.id}: ключ не уникален ${used}`); break }
      if (used.includes(s.extraQ)) { errs.push(`${b.id}: лишний вопрос ${s.extraQ} в ключе`); break }
    }
  }
  if (errs.length) throw new Error("readingEng checkReading:\n" + errs.join("\n"))
}
checkReading()
