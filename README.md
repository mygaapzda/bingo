# CS2 Bingo 🎯

> **2 найзын CS2 Bingo тоглоом** — хэн нь түрүүлж 5 зэрэгцээ challenge хийх вэ?

## Тоглоомын дүрэм
- 5×5 Bingo grid — CS2 challenge-үүдтэй
- Challenge биелүүлсэн бол нүдэн дээр дарна
- **5 зэрэгцээ** (мөр / багана / диагональ) болгосон хүн **хожно**
- Хожсоны дараа 5 секундын дараа автоматаар **шинэ random grid**-ийн дараагийн раунд эхэлнэ

## GitHub Pages дээр тавих заавар

### 1. Firebase Project үүсгэх

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project**
2. Project нэрийг `cs2bingo` гэж өг
3. **Realtime Database** → Create database → **Start in test mode**
4. **Project Settings** → **Your apps** → Web app нэмэх → Config copy хийх

### 2. `firebase-config.js` засах

```js
const firebaseConfig = {
  apiKey: "ЧИНИЙ_API_KEY",
  authDomain: "ЧИНИЙ_PROJECT.firebaseapp.com",
  databaseURL: "https://ЧИНИЙ_PROJECT-default-rtdb.firebaseio.com",
  projectId: "ЧИНИЙ_PROJECT",
  storageBucket: "ЧИНИЙ_PROJECT.appspot.com",
  messagingSenderId: "ЧИНИЙ_SENDER_ID",
  appId: "ЧИНИЙ_APP_ID"
};
```

### 3. Firebase Database Rules тохируулах

Firebase Console → Realtime Database → Rules → энийг paste хий:

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

### 4. GitHub Pages дээр deploy хийх

```bash
git init
git add .
git commit -m "CS2 Bingo v1"
git remote add origin https://github.com/ЧИНИЙ_ХЭРЭГЛЭГЧ/bingo.git
git push -u origin main
```

GitHub → Repository → **Settings** → **Pages** → **Branch: main** → Save

### 5. Тоглох

1. `https://ЧИНИЙ_ХЭРЭГЛЭГЧ.github.io/bingo` хаягийг нээ
2. Өрөөний нэр, нэрээ оруул → **Нэгдэх**
3. **Share линкийг найздаа** илгээ — тэр нэгдэнэ
4. P1 (host) **Тоглоом эхлүүлэх** дарна
5. Enjoy! 🎮
