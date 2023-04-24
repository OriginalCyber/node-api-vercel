const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("./models/User.cjs");
const Report = require("./models/Report.cjs");
const cookieParser = require("cookie-parser");
const imageDownloader = require("image-downloader");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const multer = require("multer");
const fs = require("fs");
const mime = require("mime-types");

require("dotenv").config();
const app = express();

const bcryptSalt = bcrypt.genSaltSync(10);
const jwtSecret = "fasefraw4r5r3wq45wdfgw34twdfg";
const bucket = 'report-app';

app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(__dirname + "/uploads"));
app.use(
    cors({
        credentials: true,
        origin: "http://localhost:5173",
    })
);

async function uploadToS3(path, originalFilename, mimetype) {
    const client = new S3Client({
        region: "us-east-1",
        credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        },
    });
    const parts = originalFilename.split(".");
    const ext = parts[parts.length - 1];
    const newFilename = Date.now() + "." + ext;
    await client.send(
        new PutObjectCommand({
            Bucket: bucket,
            Body: fs.readFileSync(path),
            Key: newFilename,
            ContentType: mimetype,
            ACL: "public-read",
        })
    );
    return `https://${bucket}.s3.amazonaws.com/${newFilename}`;
}

// function getUserDataFromReq(req) {
//   return new Promise((resolve, reject) => {
//     jwt.verify(req.cookies.token, jwtSecret, {}, async (err, userData) => {
//       if (err) throw err;
//       resolve(userData);
//       resolve(reportData);
//     });
//   });
// }

app.get("/test", (req, res) => {
    mongoose.connect(process.env.MONGO_URL);
    res.json("test ok");
});

app.post("/register", async (req, res) => {
    mongoose.connect(process.env.MONGO_URL);
    const { name, email, password, number, phone, agency } = req.body;
    try {
        const userDoc = await User.create({
            name,
            email,
            password: bcrypt.hashSync(password, bcryptSalt),
            number,
            phone,
            agency,
        });
        res.json(userDoc);
    } catch (e) {
        res.status(404).json(e);
    }
});

app.post("/login", async (req, res) => {
    mongoose.connect(process.env.MONGO_URL);
    const { email, password } = req.body;
    const userDoc = await User.findOne({ email });
    if (userDoc) {
        const passOk = bcrypt.compareSync(password, userDoc.password);
        if (passOk) {
            jwt.sign(
                {
                    email: userDoc.email,
                    id: userDoc._id,
                },
                jwtSecret,
                {},
                (err, token) => {
                    if (err) throw err;
                    res.cookie("token", token).json(userDoc);
                }
            );
        } else {
            res.status(422).json("pass not ok");
        }
    } else {
        res.json("not found");
    }
});

app.get("/profile", (req, res) => {
    mongoose.connect(process.env.MONGO_URL);
    const { token } = req.cookies;
    if (token) {
        jwt.verify(token, jwtSecret, {}, async (err, userData) => {
            if (err) throw err;
            const { _id, name, email, number, phone, agency } = await User.findById(
                userData.id
            );
            res.json({ _id, name, email, number, phone, agency });
        });
    } else {
        res.json(null);
    }
});

app.post("/logout", (req, res) => {
    res.cookie("token", "").json(true);
});

app.post("/upload-by-link", async (req, res) => {
    const { link } = req.body;
    const newName = "photo" + Date.now() + ".jpg";
    await imageDownloader.image({
        url: link,
        dest: "/tmp/" + newName,
    });
    const url = await uploadToS3(
        "/tmp/" + newName,
        newName,
        mime.lookup("/tmp/" + newName)
    );
    res.json(url);
});

const photosMiddleware = multer({ dest: "/tmp" });
app.post("/upload", photosMiddleware.array("photos", 100), async (req, res) => {
    const uploadedFiles = [];
    for (let i = 0; i < req.files.length; i++) {
        const { path, originalname, mimetype } = req.files[i];
        const url = await uploadToS3(path, originalname, mimetype);
        uploadedFiles.push(url);
    }
    res.json(uploadedFiles);
});

app.post("/reports", async (req, res) => {
    mongoose.connect(process.env.MONGO_URL);
    const { title, phone, date, time, address, description, addedPhotos } = req.body;
    try {
        const reportDoc = await Report.create({
            title, phone, date, time, address, description, photos: addedPhotos,
        });
        res.json(reportDoc);
    } catch (e) {
        res.status(404).json;
    }
})

app.get("/reports", (req, res) => {
    mongoose.connect(process.env.MONGO_URL);
    const { token } = req.cookies;
    jwt.verify(token, jwtSecret, {}, async (err, reportData) => {
        res.json(await Report.find({}));
    });
});

app.get("/reports/:id", async (req, res) => {
    mongoose.connect(process.env.MONGO_URL);
    const { id } = req.params;
    res.json(await Report.findById(id));
});

app.put("/reports", async (req, res) => {
    mongoose.connect(process.env.MONGO_URL);
    const { token } = req.cookies;
    const { id, title, phone, date, time, address, description, addedPhotos, } = req.body;
    jwt.verify(token, jwtSecret, {}, async (err, reportData) => {
        if (err) throw err;
        const reportDoc = await Report.findById(id);
        if (reportData.id === reportDoc.owner.toString()) {
            reportDoc.set({
                title,
                phone,
                date,
                time,
                address,
                description,
                addedPhotos,
            });
            await reportDoc.save();
            res.json("ok");
        }
    });
});

app.get("/reports", async (req, res) => {
    mongoose.connect(process.env.MONGO_URL);
    res.json(await Report.find());
});

app.listen(4000);
