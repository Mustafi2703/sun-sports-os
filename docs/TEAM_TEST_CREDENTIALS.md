# Sun Sports SportsOS — Team test credentials

**App (live):** https://sun-sports-os.vercel.app  
**API (live):** https://sun-sports-api-production.up.railway.app  

Use **Mobile number + PIN** on every portal. OTP SMS will be connected later (OTP tab remains for when SMS is live).

**Default PIN for all seeded accounts:** `1234`

Only onboarded numbers work. Unknown numbers are rejected.

---

## 1. Internal Team (admin)

| Field | Value |
|-------|--------|
| Portal | https://sun-sports-os.vercel.app/app/login |
| Mobile | `9000000001` |
| PIN | `1234` |

Use this for students, fees, packages, coaches, attendance, holidays.

---

## 2. Coaches

Portal: https://sun-sports-os.vercel.app/coach/login  
PIN for all: `1234`

| Coach | Mobile | Notes |
|-------|--------|--------|
| **Harry Sir** (Head Coach) | `9033002641` | Sees fee structures; can declare academy closures / no-session days |
| Vikas Sir | `8320901989` | No fee structures |
| Zala Sir | `7573829550` | No fee structures |
| Akhil Sir | `8160746822` | No fee structures |
| Siddhant Sir | `9265752962` | No fee structures |
| Utsav Sir | `7990591885` | No fee structures |

---

## 3. Parents

Portal: https://sun-sports-os.vercel.app/parent/login  
PIN for all: `1234`

| Parent | Mobile | Child (approx.) |
|--------|--------|------------------|
| Ronak Patel | `9712939753` | Ayaan Patel |
| Ami Kanzaria | `8490063521` | Hayaan Kanzaria |
| Rajesh Verma | `7654321098` | Rishit Patel |
| Aditya Desai | `9998060606` | Samar Desai |
| Chetna Desai | `9687471747` | Rajveer Desai |
| Hardevsinh Vaghela | `9727389727` | Satyaraj Vaghela |
| Jatin Patel | `9824717103` | Pratham Patel |
| Sunil Yadav | `9664859001` | Vishal Yadav |
| Mahipalsinh Rana | `9099937890` | Jash Rana |
| Jigar Patel | `9825123397` | Shwet Patel |
| Jitendrasinh Zala | `7573829550` | Aditya Zala |

---

## 4. Quick demo path (before client delivery)

1. **Team** → login `9000000001` / `1234`  
2. **Students** → add/edit student, choose fee package (1 / 3 / 6 / 12 months)  
3. **Fees** → monthly dues, mark paid  
4. **Attendance** → mark session; optionally publish a holiday  
5. **Coaches** → confirm Harry is Head coach  
6. **Coach Harry** → `9033002641` / `1234` → Fee structures + closures  
7. **Other coach** → e.g. `8320901989` / `1234` → no fees tab  
8. **Parent** → e.g. `9712939753` / `1234` → fees + attendance calendar  

---

## 5. Notes

- Login no longer shows “quick fill / select user” chips — type the mobile number.
- OTP remains available for later SMS (MSG91 / Twilio). Until then, use **Mobile + PIN**.
- Fee packages: Monthly ₹15k · Quarterly ₹14k/mo · Half year ₹13k/mo · Annual ₹12k/mo.
- Do not share this file publicly after delivery; rotate PINs if numbers are real production WhatsApp lines.
