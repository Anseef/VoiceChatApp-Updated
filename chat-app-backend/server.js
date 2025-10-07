const express = require('express');
const { MongoClient, ObjectId } = require('mongodb'); // Ensure ObjectId is imported
const cors = require('cors');
require('dotenv').config();

// --- Server Setup ---
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// --- Database Connection Details ---
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

// Declare database and collections globally
let database;
let chatsCollection;
let messagesCollection;
let contactsCollection; // Assuming you have a contacts collection too

// --- Connect to MongoDB once when the server starts ---
async function connectToMongo() {
    try {
        await client.connect();
        console.log("MongoDB connected successfully!");

        // Assign database and collections AFTER connection is established
        database = client.db('echobridge');
        chatsCollection = database.collection('chats');
        messagesCollection = database.collection('messages');
        contactsCollection = database.collection('contact'); // Assuming this exists

    } catch (error) {
        console.error("🔥 Could not connect to MongoDB:", error);
        // Exit the process if we can't connect to the DB
        process.exit(1);
    }
}


// --- Route Handlers ---

app.get('/contact', async (req, res) => {
    console.log('Request received for /contact');
    try {
        if (!contactsCollection) {
            return res.status(500).json({ message: "Database not fully initialized." });
        }
        const contacts = await contactsCollection.find({}).toArray();
        res.json(contacts);
    } catch (error) {
        console.error("🔥 An error occurred fetching contacts:", error);
        res.status(500).json({ message: "Error fetching data from database." });
    }
});


app.get('/chats', async (req, res) => {
    console.log('Request received for /chats');
    try {
        if (!chatsCollection) {
            return res.status(500).json({ message: "Database not fully initialized." });
        }
        const chats = await chatsCollection.find({}).toArray();
        res.json(chats);
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

        // console.log("Backend POST /chats received data:");
        // console.log("  senderId:", senderId);
        // console.log("  partnerId:", partnerId);
        // console.log("  partnerName:", partnerName);
        // console.log("  senderName:", senderName);
        // --- END Backend POST /chats received data: ---

        // Added a check for senderName, as it's used in the newChat object
        if (!partnerId || !partnerName || !senderId || !senderName) {
            console.error("Missing fields for chat creation:", req.body);
            return res.status(400).json({ message: "Missing required chat creation fields." });
        }

        // Check for existing chat between these two participants (order-independent)
        const existingChat = await chatsCollection.findOne({
            $or: [
                { participant1Id: senderId, participant2Id: partnerId },
                { participant1Id: partnerId, participant2Id: senderId }
            ]
        });

        if (existingChat) {
            // console.log("Backend POST /chats - Chat already exists. Returning existing chat:", existingChat);
            return res.status(200).json({ message: "Chat already exists.", chat: existingChat });
        }

        // If no existing chat, create a new one
        const newChat = {
            participant1Id: senderId,
            participant2Id: partnerId,
            name: partnerName, // The name of the person THIS user is chatting with
            image: partnerImage || 'profileDemo.jpg',
            lastMessage: 'Say hello to start the conversation!',
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
            unread: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await chatsCollection.insertOne(newChat);
        const createdChat = { _id: result.insertedId, ...newChat };

        // --- LOG THE CREATED CHAT OBJECT BEFORE SENDING RESPONSE (Debugging Log) ---
        // console.log("Backend POST /chats - createdChat object before sending response:", createdChat);

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
            read: false, // Messages are initially unread by the recipient
        };

        const result = await messagesCollection.insertOne(newMessage);
        const createdMessage = { _id: result.insertedId, ...newMessage };

        // Update the lastMessage and time in the associated chat
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
        const { readerId } = req.body; // The ID of the user who is marking messages as read

        if (!readerId) {
            return res.status(400).json({ message: "Missing readerId for marking messages as read." });
        }

        // Mark all messages in this chat as read, *except* those sent by the readerId itself
        const updateResult = await messagesCollection.updateMany(
            {
                chatId: chatId,
                senderId: { $ne: readerId }, // Do not mark messages sent by the reader as unread
                read: false // Only mark unread messages
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

// --- Start the Server ---
// Call connectToMongo() ONCE, and then start the server in its .then() block
connectToMongo().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Server is running on http://10.180.131.188:${PORT}`);
    });
});

// Handle graceful shutdown to close MongoDB connection
process.on('SIGINT', async () => {
    console.log('Shutting down server...');
    await client.close();
    console.log('MongoDB connection closed.');
    process.exit(0);
});