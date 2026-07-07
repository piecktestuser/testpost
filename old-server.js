const express = require("express");
const cors = require("cors");
const cheerio = require("cheerio");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const BASE_URL = "http://sakol-kwtvkzdbnqc.dynamic-m.com:8080/school";
const COOKIE = "JSESSIONID=CD249E530140FAD48404964364656397";

// ===========================================
// ค้นหารหัสบัตรจาก Member ID
// รองรับ
// 08388
// t0024
// T0068
// ===========================================
async function findCardByMemberID(memberID) {

    const response = await fetch(
        `${BASE_URL}/cardList.do`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Cookie": COOKIE
            },
            body: new URLSearchParams({
                cardNo: "",
                cardTypeCode: "",
                memberTypeCode: "",
                memberID: memberID,
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

        const status = $(td[9]).text().trim();

        if (status !== "ใช้งานอยู่") return;

        result = {

            memberID,

            cardNo: $(td[1]).text().trim(),

            balance: $(td[7]).text().trim(),

            name: $(td[8])
                .text()
                .replace(/\s+/g, " ")
                .replace(/^.*?,/, "")
                .trim(),

            status

        };

    });

    return result;

}

// ===========================================
// เช็กยอดเงิน
// ===========================================
async function checkBalance(cardNo) {

    const response = await fetch(
        `${BASE_URL}/foodCardDairyBalance.do`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Cookie": COOKIE
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

// ===========================================
// API
// ===========================================
app.post("/api/check", async (req, res) => {

    try {

        const input = (req.body.cardNo || "").trim();

        if (!input) {

            return res.status(400).json({

                success: false,

                message: "กรุณากรอกรหัส"

            });

        }

        let memberID = "";
        let cardNo = "";
        let cardInfo = null;

        // รหัสบัตร เช่น d7d1401f หรือ 28bbcaef
        const isCardNo = /^[0-9a-f]{8}$/i.test(input);

        if (isCardNo) {

            cardNo = input;

        } else {

            // รหัสนักเรียน / ครู / บุคลากร
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

        console.error(err);

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

});

app.listen(3000, () => {

    console.log("====================================");
    console.log("Server Start");
    console.log("http://localhost:3000");
    console.log("====================================");

});