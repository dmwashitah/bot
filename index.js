// index.js
const venom = require('venom-bot');
const express = require('express');
require('dotenv').config();

const ADMIN_NUMBER = process.env.ADMIN_NUMBER || '+263719898282';

// Room list and prices
const rooms = [
  { id: 1, name: 'Yellow Hub', price: 60 },
  { id: 2, name: 'Purple Hub', price: 60 },
  { id: 3, name: 'White Hub', price: 60 },
  { id: 4, name: 'Executive 1', price: 50 },
  { id: 5, name: 'Executive 2', price: 50 },
  { id: 6, name: 'Standard 1', price: 40 },
  { id: 7, name: 'Standard 2', price: 40 },
  { id: 8, name: 'Full House', price: 250 }
];

// User sessions to track conversation state
const userSessions = {};

// Start the Venom bot
venom.create().then((client) => start(client)).catch((error) => console.log(error));

function start(client) {
  console.log('Bot started successfully.');

  client.onMessage(async (message) => {
    const from = message.from;

    // Initialize session if not exists
    if (!userSessions[from]) {
      userSessions[from] = { step: 0, booking: {} };
    }

    const session = userSessions[from];
    const userText = message.body.trim().toLowerCase();

    // Step 0: Welcome message
    if (session.step === 0) {
      await client.sendText(from,
        '👋 *Welcome to Umziki Way Guesthouse!*\n' +
        'Would you like to view our rooms and prices?\n\n' +
        '*Reply with:* \n' +
        '1️⃣ View Rooms & Prices\n' +
        '2️⃣ Make a Booking\n'
      );
      session.step = 1;
      return;
    }

    // Step 1: Choose action
    if (session.step === 1) {
      if (userText === '1' || userText.includes('view')) {
        let roomList = '*Our Rooms & Prices:*\n';
        rooms.forEach((room) => {
          roomList += `${room.id}. ${room.name} - $${room.price}/night\n`;
        });
        roomList += '\nReply with the *room number(s)* you want to book (e.g., 1 or 1,2).';
        await client.sendText(from, roomList);
        session.step = 2;
        return;
      } else if (userText === '2' || userText.includes('book')) {
        await client.sendText(from, 'Please select rooms first. Type "1" to view our rooms.');
        return;
      } else {
        await client.sendText(from, '❌ Invalid option. Reply with 1 or 2.');
        return;
      }
    }

    // Step 2: Select room(s)
    if (session.step === 2) {
      const selected = userText.split(',').map((num) => parseInt(num.trim())).filter(Boolean);
      const selectedRooms = rooms.filter((room) => selected.includes(room.id));

      if (selectedRooms.length === 0) {
        await client.sendText(from, '❌ Invalid room number. Please enter valid room numbers (e.g., 1 or 1,2).');
        return;
      }

      session.booking.rooms = selectedRooms;
      session.step = 3;
      await client.sendText(from, 'Please enter your *Full Name* (Name and Surname):');
      return;
    }

    // Step 3: Name
    if (session.step === 3) {
      session.booking.name = message.body.trim();
      session.step = 4;
      await client.sendText(from, 'Please enter your *Age*:');
      return;
    }

    // Step 4: Age
    if (session.step === 4) {
      session.booking.age = message.body.trim();
      session.step = 5;
      await client.sendText(from, 'Enter *Check-in Date* (format YYYY-MM-DD):');
      return;
    }

    // Step 5: Check-in Date
    if (session.step === 5) {
      session.booking.checkIn = message.body.trim();
      session.step = 6;
      await client.sendText(from, 'Enter *Number of Nights*:');
      return;
    }

    // Step 6: Nights
    if (session.step === 6) {
      const nights = parseInt(message.body.trim());
      if (isNaN(nights) || nights <= 0) {
        await client.sendText(from, '❌ Invalid number of nights. Please enter a valid number.');
        return;
      }
      session.booking.nights = nights;

      // Calculate total
      const total = session.booking.rooms.reduce((sum, room) => sum + room.price * nights, 0);
      session.booking.total = total;

      // Show summary
      let summary = `*Booking Summary:*\n\n`;
      summary += `👤 Name: ${session.booking.name}\n`;
      summary += `🎂 Age: ${session.booking.age}\n`;
      summary += `🛏 Rooms: ${session.booking.rooms.map(r => r.name).join(', ')}\n`;
      summary += `📅 Check-in: ${session.booking.checkIn}\n`;
      summary += `⏳ Nights: ${nights}\n`;
      summary += `💵 Total: $${total}\n\n`;
      summary += 'Reply with *YES* to confirm or *NO* to cancel.';
      await client.sendText(from, summary);
      session.step = 7;
      return;
    }

    // Step 7: Confirmation
    if (session.step === 7) {
      if (userText === 'yes') {
        const bookingMsg =
          `*New Booking Alert!*\n\n` +
          `👤 Name: ${session.booking.name}\n` +
          `🎂 Age: ${session.booking.age}\n` +
          `🛏 Rooms: ${session.booking.rooms.map(r => r.name).join(', ')}\n` +
          `📅 Check-in: ${session.booking.checkIn}\n` +
          `⏳ Nights: ${session.booking.nights}\n` +
          `💵 Total: $${session.booking.total}\n\n` +
          `From: ${from}`;
        await client.sendText(ADMIN_NUMBER + '@c.us', bookingMsg);
        await client.sendText(from, '✅ Your booking has been confirmed and sent to admin. Thank you!');
        session.step = 0; // Reset session
      } else if (userText === 'no') {
        await client.sendText(from, '❌ Booking cancelled. You can type "1" to view rooms again.');
        session.step = 0;
      } else {
        await client.sendText(from, 'Please reply with *YES* or *NO*.');
      }
      return;
    }
  });
}

// Express server for Render deployment
const app = express();
app.get('/', (req, res) => res.send('WhatsApp Booking Bot is running.'));
app.listen(process.env.PORT || 3000, () => console.log('Server is running...'));
