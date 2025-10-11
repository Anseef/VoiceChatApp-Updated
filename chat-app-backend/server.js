const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

let database;
let chatsCollection;
let messagesCollection;
let contactsCollection;
let usersCollection;

async function connectToMongo() {
    try {
        await client.connect();
        console.log("MongoDB connected successfully!");

        database = client.db('echobridge');
        chatsCollection = database.collection('chats');
        messagesCollection = database.collection('messages');
        contactsCollection = database.collection('contact');
        usersCollection = database.collection('users');

    } catch (error) {
        console.error("🔥 Could not connect to MongoDB:", error);
        process.exit(1);
    }
}

app.post('/signup', async (req, res) => {
    console.log('Request received for /signup (POST)');
    try {
        if (!usersCollection) {
            return res.status(500).json({ message: "Database not fully initialized." });
        }
        // Destructure username along with email and password
        const { username, email, password } = req.body;

        // Check if all required fields are present for signup
        if (!username || !email || !password) {
            return res.status(400).json({ message: "Username, email, and password are required for signup." });
        }

        // Check if a user with that email already exists
        const existingUserByEmail = await usersCollection.findOne({ email });
        if (existingUserByEmail) {
            return res.status(409).json({ message: "User with that email already exists." });
        }

        // Optional: Check if a user with that username already exists (if usernames must be unique)
        const existingUserByUsername = await usersCollection.findOne({ username });
        if (existingUserByUsername) {
            return res.status(409).json({ message: "User with that username already exists." });
        }

        // In a real app, hash the password here before saving!
        // const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = {
            username: username, // Store the username
            email: email,
            password: password,
            createdAt: new Date(),
        };

        const result = await usersCollection.insertOne(newUser);
        // Return username and email (but not password)
        const createdUser = { _id: result.insertedId, username: newUser.username, email: newUser.email };

        console.log(`User signed up: ${createdUser.email} (username: ${createdUser.username})`);
        res.status(201).json({ message: "User registered successfully.", user: createdUser });

    } catch (error) {
        console.error("🔥 An error occurred during signup:", error);
        res.status(500).json({ message: "Error during user registration." });
    }
});

app.post('/login', async (req, res) => {
    console.log('Request received for /login (POST)');
    try {
        if (!usersCollection) {
            return res.status(500).json({ message: "Database not fully initialized." });
        }
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: "Username and password are required for login." });
        }

        const user = await usersCollection.findOne({ username });
        if (!user) {
            return res.status(401).json({ message: "Invalid credentials." });
        }

        const isPasswordValid = (password === user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid credentials." });
        }

        // Successful login - include username in the response
        const loggedInUser = { _id: user._id, username: user.username, email: user.email };

        console.log(`User logged in: ${loggedInUser.email} (username: ${loggedInUser.username})`);
        res.status(200).json({ message: "Login successful.", user: loggedInUser });

    } catch (error) {
        console.error("🔥 An error occurred during login:", error);
        res.status(500).json({ message: "Error during user login." });
    }
});

// app.get('/contact', async (req, res) => {
//     console.log('Request received for /contact');
//     try {
//         if (!contactsCollection) {
//             return res.status(500).json({ message: "Database not fully initialized." });
//         }
//         const contacts = await contactsCollection.find({}).toArray();
//         res.json(contacts);
//     } catch (error) {
//         console.error("🔥 An error occurred fetching contacts:", error);
//         res.status(500).json({ message: "Error fetching data from database." });
//     }
// });

app.get('/chats', async (req, res) => {
    console.log('Request received for /chats');
    try {
        if (!chatsCollection) {
            return res.status(500).json({ message: "Database not fully initialized." });
        }
        const chats = await chatsCollection.find({}).toArray();

        // Map over the chats to convert _id from ObjectId to string
        const formattedChats = chats.map(chat => ({
            ...chat, // Keep all existing properties
            _id: chat._id.toString(), // Convert the chat's _id to a string
        }));

        console.log('DEBUG: Sending formatted chats to frontend:', formattedChats);
        res.json(formattedChats);
    } catch (error) {
        console.error("🔥 An error occurred fetching chats:", error);
        res.status(500).json({ message: "Error fetching chats from database." });
    }
});

app.post('/chats', async (req, res) => {
    console.log('Request received for /chats (POST)');
    try {
        if (!chatsCollection) {
            return res.status(500).json({ message: "Database not fully initialized." });
        }
        const { partnerId, partnerName, partnerImage, senderId, senderName } = req.body;

        if (!partnerId || !partnerName || !senderId || !senderName) {
            console.error("Missing fields for chat creation:", req.body);
            return res.status(400).json({ message: "Missing required chat creation fields." });
        }

        // The existing chat check already uses participant1Id and participant2Id
        const existingChat = await chatsCollection.findOne({
            $or: [
                { participant1Id: senderId, participant2Id: partnerId },
                { participant1Id: partnerId, participant2Id: senderId }
            ]
        });

        if (existingChat) {
            return res.status(200).json({ message: "Chat already exists.", chat: existingChat });
        }

        // *** THIS IS WHERE THE FIELDS NEED TO BE ADDED TO THE DOCUMENT ***
        const newChat = {
            participant1Id: senderId, // <--- These are correctly assigned here
            participant2Id: partnerId, // <--- These are correctly assigned here
            name: partnerName, // This 'name' is for the *other* participant's name for display in the list
            image: partnerImage || 'profileDemo.jpg',
            lastMessage: 'Say hello to start the conversation!',
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
            unread: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await chatsCollection.insertOne(newChat);
        const createdChat = { _id: result.insertedId, ...newChat };
        res.status(201).json({ message: "Chat created successfully.", chat: createdChat });

    } catch (error) {
        console.error("🔥 An error occurred creating chat:", error);
        res.status(500).json({ message: "Error creating chat in database." });
    }
});

app.get('/chats/:chatId/messages', async (req, res) => {
    console.log(`Request received for /chats/${req.params.chatId}/messages`);
    try {
        if (!messagesCollection) {
            return res.status(500).json({ message: "Database not fully initialized." });
        }
        const chatId = new ObjectId(req.params.chatId);
        const chatMessages = await messagesCollection.find({ chatId }).sort({ createdAt: 1 }).toArray();
        res.json(chatMessages);
    } catch (error) {
        console.error("🔥 An error occurred fetching messages:", error);
        res.status(500).json({ message: "Error fetching messages from database." });
    }
});

app.post('/chats/:chatId/messages', async (req, res) => {
    console.log(`Request received for /chats/${req.params.chatId}/messages (POST)`);
    try {
        if (!messagesCollection || !chatsCollection) {
            return res.status(500).json({ message: "Database not fully initialized." });
        }
        const chatId = new ObjectId(req.params.chatId);
        const { senderId, text } = req.body;

        if (!senderId || !text) {
            return res.status(400).json({ message: "Missing senderId or text for message." });
        }

        const newMessage = {
            chatId: chatId,
            senderId: senderId,
            text: text,
            createdAt: new Date(),
            read: false,
        };

        const result = await messagesCollection.insertOne(newMessage);
        const createdMessage = { _id: result.insertedId, ...newMessage };

        await chatsCollection.updateOne(
            { _id: chatId },
            {
                $set: {
                    lastMessage: text,
                    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
                    updatedAt: new Date()
                }
            }
        );

        res.status(201).json({ message: "Message sent successfully.", message: createdMessage });

    } catch (error) {
        console.error("🔥 An error occurred sending message:", error);
        res.status(500).json({ message: "Error sending message to database." });
    }
});

app.put('/chats/:chatId/messages/read', async (req, res) => {
    console.log(`Request received for /chats/${req.params.chatId}/messages/read (PUT)`);
    try {
        if (!messagesCollection) {
            return res.status(500).json({ message: "Database not fully initialized." });
        }
        const chatId = new ObjectId(req.params.chatId);
        const { readerId } = req.body;

        if (!readerId) {
            return res.status(400).json({ message: "Missing readerId for marking messages as read." });
        }

        const updateResult = await messagesCollection.updateMany(
            {
                chatId: chatId,
                senderId: { $ne: readerId },
                read: false
            },
            {
                $set: { read: true }
            }
        );

        res.status(200).json({ message: `${updateResult.modifiedCount} messages marked as read.` });

    } catch (error) {
        console.error("🔥 An error occurred marking messages as read:", error);
        res.status(500).json({ message: "Error marking messages as read." });
    }
});

connectToMongo().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Server is running on http://10.180.131.188:${PORT}`);
    });
});

process.on('SIGINT', async () => {
    console.log('Shutting down server...');
    await client.close();
    console.log('MongoDB connection closed.');
    process.exit(0);
});