const venom = require('venom-bot');
const express = require('express');

const rooms = [
  { name: 'Yellow Hub', price: 60 },
  { name: 'Purple Hub', price: 60 },
  { name: 'White Hub', price: 60 },
  { name: 'Executive 1', price: 50 },
  { name: 'Executive 2', price: 50 },
  { name: 'Standard 1', price: 40 },
  { name: 'Standard 2', price: 40 },
  { name: 'Full House', price: 250 }
];

const userSessions = {};
const ADMIN_NUMBER = '+263719898282@c.us';
let clientInstance = null;
let lastMessageTime = Date.now();

function createBot() {
  console.log('Starting Mathanda Guest House Bot...');
  venom
    .create({
      session: 'guesthouse',
      multidevice: true,
      browserArgs: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--headless=new'
      ],
      autoClose: false
    })
    .then(client => {
      clientInstance = client;
      start(client);
    })
    .catch(err => {
      console.error('Venom error:', err);
      console.log('Restarting bot in 10 seconds...');
      setTimeout(createBot, 10000);
    });
}

createBot(); // Start bot

function start(client) {
  console.log('Bot is running...');
  lastMessageTime = Date.now();

  client.onMessage(async message => {
    lastMessageTime = Date.now();
    try {
      await handleMessage(client, message);
    } catch (err) {
      console.error('Error handling message:', err);
    }
  });

  client.onStateChange(state => {
    console.log('STATE:', state);
    if (state === 'CONFLICT' || state === 'UNPAIRED' || state === 'UNLAUNCHED') {
      console.log('Bot state unstable, restarting...');
      restartBot();
    }
  });
}

// Main message handler
async function handleMessage(client, message) {
  const from = message.from;
  const guestNumber = from.replace('@c.us', '');
  const user = (userSessions[from] = userSessions[from] || { step: 0 });
  const msg = message.body.trim().toLowerCase();

  if (msg === 'reset') {
    userSessions[from] = { step: 0 };
    return await client.sendText(from, '🔄 Session reset. Type *hi* to start again.');
  }

  if (msg === 'hi' || msg === 'menu') {
    user.step = 1;
    return await client.sendText(
      from,
      `🌟 *Welcome to Mathanda Guest House!* 🌟\n\nPlease check our catalogue on this WhatsApp number.\n\nWhen you are ready, type *1* to see the available rooms.`
    );
  }

  if (user.step === 1 && msg === '1') {
    let roomList = '*Available Rooms & Prices (per night)*\n\n';
    rooms.forEach((room, index) => {
      roomList += `${index + 1}. ${room.name} - $${room.price}\n`;
    });
    await client.sendText(from, roomList + '\nPlease reply with the *number(s)* of the room(s) you want.');
    user.step = 2;
    return;
  }

  if (user.step === 2) {
    const selectedIndexes = message.body
      .split(',')
      .map(n => parseInt(n.trim()) - 1)
      .filter(n => n >= 0 && n < rooms.length);

    if (selectedIndexes.length === 0) {
      return await client.sendText(from, '❌ Invalid selection. Please enter valid room number(s).');
    }

    user.selectedRooms = selectedIndexes.map(i => rooms[i]);
    await client.sendText(from, '✅ Rooms selected. How many *guests* will be staying?');
    user.step = 2.5;
    return;
  }

  if (user.step === 2.5) {
    user.guests = parseInt(message.body) || 1;
    await client.sendText(from, 'Please enter your *full name*.');
    user.step = 3;
    return;
  }

  if (user.step === 3) {
    user.name = message.body;
    await client.sendText(from, 'Please enter *check-in date* (YYYY-MM-DD).');
    user.step = 4;
    return;
  }

  if (user.step === 4) {
    user.checkIn = message.body;
    await client.sendText(from, 'Please enter *check-out date* (YYYY-MM-DD).');
    user.step = 5;
    return;
  }

  if (user.step === 5) {
    user.checkOut = message.body;

    const nights = calculateNights(user.checkIn, user.checkOut);
    const totalCost = user.selectedRooms.reduce((sum, r) => sum + r.price * nights, 0);

    await client.sendText(
      from,
      `📝 *Booking Summary:*\n\n` +
        `👤 Name: ${user.name}\n` +
        `👥 Guests: ${user.guests}\n` +
        `🏠 Rooms: ${user.selectedRooms.map(r => r.name).join(', ')}\n` +
        `📅 Check-in: ${user.checkIn}\n📅 Check-out: ${user.checkOut}\n` +
        `🌙 Nights: ${nights}\n💵 Total Cost: $${totalCost}\n\n` +
        `To confirm your booking, type *confirm*.`
    );

    user.totalCost = totalCost;
    user.nights = nights;
    user.step = 6;
    return;
  }

  if (user.step === 6 && msg === 'confirm') {
    await client.sendText(from, '✅ Thank you! Your booking has been sent to the admin.');

    await client.sendText(
      ADMIN_NUMBER,
      `📢 *New Booking Alert!*\n\n` +
        `📞 Guest Number: +${guestNumber}\n` +
        `👤 Name: ${user.name}\n` +
        `👥 Guests: ${user.guests}\n` +
        `🏠 Rooms: ${user.selectedRooms.map(r => r.name).join(', ')}\n` +
        `📅 Check-in: ${user.checkIn}\n` +
        `📅 Check-out: ${user.checkOut}\n` +
        `🌙 Nights: ${user.nights}\n` +
        `💵 Total Cost: $${user.totalCost}`
    );

    userSessions[from] = { step: 0 };
  }
}

function calculateNights(checkIn, checkOut) {
  try {
    const inDate = new Date(checkIn);
    const outDate = new Date(checkOut);
    const diff = (outDate - inDate) / (1000 * 60 * 60 * 24);
    return diff > 0 ? diff : 1;
  } catch (e) {
    return 1;
  }
}

// Watchdog: Restart if no message is processed in 5 minutes
setInterval(() => {
  if (Date.now() - lastMessageTime > 5 * 60 * 1000) {
    console.log('No activity detected, restarting bot...');
    restartBot();
  }
}, 60000);

function restartBot() {
  if (clientInstance) {
    try {
      clientInstance.close();
    } catch (err) {
      console.error('Error closing client:', err);
    }
  }
  setTimeout(createBot, 5000);
}

// Global error handlers
process.on('uncaughtException', err => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', reason => {
  console.error('Unhandled Rejection:', reason);
});

// Keep alive server
const app = express();
app.get('/', (req, res) => res.send('Mathanda Guest House Bot is running 24/7'));
app.listen(3000, () => console.log('Keep-alive server running on port 3000'));
