import express, { Request, Response } from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "path";

// Load .env explicitly from the backend directory
dotenv.config({ path: path.resolve(__dirname, ".env") });

console.log("📌 DATABASE_URL:", process.env.DATABASE_URL ? "✅ Loaded" : "❌ NOT loaded");

const app = express();
app.use(cors());
app.use(express.json());

// Log all incoming requests
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.path}`, req.body);
  next();
});

// Initialize Prisma with MongoDB connection
const prisma = new PrismaClient();

// Simple test route
app.get("/api/test", (req: Request, res: Response) => {
  res.json({ message: "✅ Backend connected to MongoDB via Prisma!" });
});

// user info (optional)
app.post("/api/user", async (req: Request, res: Response) => {
  try {
    console.log("[POST /api/user]", req.body);
    const { userId, name, age, gender, profession } = req.body;
    const data: { userId: string; name?: string; age: number; gender: string; profession: string } = {
      userId: userId,
      age: age,
      gender: gender,
      profession: profession,
    };
    if (typeof name === "string" && name.trim()) data.name = name.trim();
    
    const user = await prisma.user.create({ data });
    console.log("✅ User created:", user);
    res.json({ ok: true, user });
  } catch (error) {
    console.error("❌ User creation failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

// ai text submission
app.post("/api/ai-text", async (req: Request, res: Response) => {
  try {
    console.log("[POST /api/ai-text]", req.body);
    const { text } = req.body;
    const aiEntry = await prisma.aiEntry.create({
      data: { text },
    });
    console.log("✅ AI entry created:", aiEntry);
    res.json({ ok: true, aiEntry });
  } catch (error) {
    console.error("❌ AI entry creation failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

// manual text submission
app.post("/api/manual-text", async (req: Request, res: Response) => {
  try {
    console.log("[POST /api/manual-text]", req.body);
    const { text } = req.body;
    const manualEntry = await prisma.manualEntry.create({
      data: { text },
    });
    console.log("✅ Manual entry created:", manualEntry);
    res.json({ ok: true, manualEntry });
  } catch (error) {
    console.error("❌ Manual entry creation failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

// helper to inspect current session
app.get("/api/session", async (req: Request, res: Response) => {
  try {
    console.log("[GET /api/session]");
    const users = await prisma.user.findMany();
    const aiEntries = await prisma.aiEntry.findMany();
    const manualEntries = await prisma.manualEntry.findMany();
    console.log("✅ Session data fetched:", { users, aiEntries, manualEntries });
    res.json({ users, aiEntries, manualEntries });
  } catch (error) {
    console.error("❌ Session fetch failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));

// Gracefully shutdown Prisma connection
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});






// import express from 'express'
//import { searchController, usernameController } from './controller.js'
//import { userLogin, userSignup } from './controller.js'
//import router from './route.js'
// import multer from 'multer'
// import {storage} from './config/multer.js'
//import dotenv from 'dotenv';

//dotenv.config();


// const app = express()
// const PORT = 3000

// app.use('/welcome',(req,res,next)=>{
//     console.log('A new request received at'+Date.now())
//     next()
// })

// app.use((req,res,next)=>{
//     console.log('Start')

//     res.on('finish',()=>{
//         console.log('End')
//     })

//     next()
// })

// app.use(express.urlencoded({extended:true}))
// app.use(upload.single('image'))

// Define a simple route
// app.get('/', (req,res)=>{
//     //console.log('Middle')
//     res.send('Hello, Express')
// })

//app.use(express.json());

// Supabase-related routes removed.


// app.post('/form',(req,res)=>{
//     console.log(req.body)
//     console.log(req.file);
//     res.send('Form Received')
// })

// app.get('/error',()=>{
//     throw new Error('This is test error')
// })

// app.use((err,req,res,next)=>{
//     console.error(err.message)
//     res.send('Internal server error')
// })

// app.get('/welcome', (req,res)=>{
//      res.send('Welcome to Express')
// })

// // About route
// app.get('/about', (req,res)=>{
//     res.send('This is about route')
// })

// // About route
// app.get('/contact', (req,res)=>{
//     res.send('This is contact route')
// })

// app.get('/user/:username',usernameController)

// app.get('/search',searchController)

// app.get('/user/login',userLogin)
// app.get('/user/signup',userSignup)

// app.use('/user',router)

// app.use(express.json())

// app.post('/users', (req,res)=>{
//     const { name, email } = req.body
//     res.json({
//         message: `User ${name} with email ${email} created successfully`
//     })
// })

// app.put('/users/:id', (req,res)=>{
//     const userId = req.params.id
//     const {name,email} = req.body
//     res.json({
//         message:`User ${userId} updated to ${name}, ${email}`
//     })
// })

// app.delete('/users/:id', (req,res)=>{
//     const userId = req.params.id
//     res.json({
//         message: `User with ID ${userId} deleted successfully`
//     })
// })

// // /users/name/id
// app.get('/things/:name/:id([0-9]{5})', (req,res)=>{
//     const {name, id} = req.params
//     res.json({
//         id,
//         name
//     })
// })

// // Catch-all invalid routes
// app.get('*',(req,res)=>{
//     res,send('Sorry, this is an invalid URL.')
// })

// app.listen(PORT,()=>{
//     console.log(`Server is running on http://localhost:${PORT}`)
// })