const express = require("express");
const cors = require("cors");
const cheerio = require("cheerio");

const app = express();

app.use(cors({
    origin: "https://piecktestuser.github.io",
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const BASE_URL = "http://sakol-kwtvkzdbnqc.dynamic-m.com:8080/school";

// ================================
// Session
// ================================

let sessionCookie = "";
let loginUser = "";

// ================================
// Login
// ================================

app.post("/login", async (req, res) => {

    try {

        const { memberID, password } = req.body;

        if (!memberID || !password) {

            return res.json({
                success: false,
                message: "กรุณากรอก Username และ Password"
            });

        }

        // เปิดหน้า Login เพื่อรับ Session

        const page = await fetch(
            `${BASE_URL}/loginstart.do`
        );

        const setCookie = page.headers.get("set-cookie");

        if (!setCookie) {

            return res.json({
                success: false,
                message: "ไม่สามารถสร้าง Session ได้"
            });

        }

        sessionCookie = setCookie.split(";")[0];

        // Login

        const login = await fetch(
            `${BASE_URL}/login.do`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Cookie: sessionCookie
                },

                body: new URLSearchParams({
                    memberID,
                    password
                })
            }
        );

        const html = await login.text();

        if (!html.includes("Welcome")) {

            sessionCookie = "";

            return res.json({
                success: false,
                message: "Username หรือ Password ไม่ถูกต้อง"
            });

        }

        const $ = cheerio.load(html);

        let name = $("body").text();

        name = name
            .replace(/\s+/g, " ")
            .match(/Welcome\s+(.*?)\s+Last Login/i);

        name = name ? name[1].trim() : memberID;

        loginUser = memberID;

        res.json({

            success: true,

            memberID,

            name

        });

    } catch (err) {

        console.log(err);

        res.json({

            success: false,

            message: err.message

        });

    }

});

// ================================
// Logout
// ================================

app.post("/logout", async (req, res) => {

    try {

        if (sessionCookie) {

            await fetch(`${BASE_URL}/signout.do`, {

                method: "GET",

                headers: {
                    Cookie: sessionCookie
                }

            });

        }

    } catch (err) {

        console.log(err);

    }

    sessionCookie = "";
    loginUser = "";

    res.json({
        success: true
    });

});

// ================================
// Find Card
// ================================

async function findCardByMemberID(memberID) {

    const response = await fetch(
        `${BASE_URL}/cardList.do`,
        {
            method: "POST",

            headers: {

                "Content-Type": "application/x-www-form-urlencoded",

                Cookie: sessionCookie

            },

            body: new URLSearchParams({

                cardNo: "",

                cardTypeCode: "",

                memberTypeCode: "",

                memberID,

                firstName: "",

                lastName: "",

                reqCode: "Search",

                cardStatus: ""

            })

        }
    );

    const html = await response.text();

    const $ = cheerio.load(html);

    let result = null;

    $("table tr").each((i, tr) => {

        const td = $(tr).find("td");

        if (td.length < 10) return;

        if ($(td[9]).text().trim() !== "ใช้งานอยู่") return;

        result = {

            memberID,

            cardNo: $(td[1]).text().trim(),

            balance: $(td[7]).text().trim(),

            name: $(td[8])
                .text()
                .replace(/\s+/g, " ")
                .replace(/^.*?,/, "")
                .trim()

        };

    });

    return result;

}
// ================================
// Check Balance
// ================================

async function checkBalance(cardNo) {

    const response = await fetch(
        `${BASE_URL}/foodCardDairyBalance.do`,
        {
            method: "POST",

            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Cookie: sessionCookie
            },

            body: new URLSearchParams({
                cardNo
            })

        }
    );

    const html = await response.text();

    const $ = cheerio.load(html);

    return {

        name: $('input[name="firstName"]').val() || "",

        balance: $('input[name="balance"]').val() || ""

    };

}

// ================================
// API
// ================================

app.post("/api/check", async (req, res) => {

    try {

        if (!sessionCookie) {

            return res.json({

                success: false,

                message: "กรุณา Login ก่อน"

            });

        }

        const input = (req.body.cardNo || "").trim();

        if (!input) {

            return res.json({

                success: false,

                message: "กรุณากรอกรหัส"

            });

        }

        let memberID = "";

        let cardNo = "";

        let cardInfo = null;

        // รหัสบัตร (8 ตัวอักษร Hex)

        const isCardNo = /^[0-9a-f]{8}$/i.test(input);

        if (isCardNo) {

            cardNo = input;

        } else {

            memberID = input;

            cardInfo = await findCardByMemberID(memberID);

            if (!cardInfo) {

                return res.json({

                    success: false,

                    message: "ไม่พบผู้ถือบัตร"

                });

            }

            cardNo = cardInfo.cardNo;

        }

        const balanceInfo = await checkBalance(cardNo);

        res.json({

            success: true,

            memberID: memberID || cardInfo?.memberID || "",

            cardNo,

            name: balanceInfo.name || cardInfo?.name || "",

            balance: balanceInfo.balance || cardInfo?.balance || "0"

        });

    } catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

});

// ================================
// Server
// ================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("======================================");
    console.log("MIS Food Card Server");
    console.log(`Running on port ${PORT}`);
    console.log("======================================");
});