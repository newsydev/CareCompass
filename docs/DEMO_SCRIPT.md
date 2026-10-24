# Demo video script (≤ 3 minutes)

| Time | Show | Say |
| --- | --- | --- |
| 0:00–0:15 | Login screen → sign in | "CareCompass routes home-care requests in English, Hindi and Hinglish. Everything here is synthetic and a demo." |
| 0:15–0:35 | Greeting with name/address, **Use my current location** | "It greets the logged-in user, shows their saved address and uses shared location for distance-based matching." |
| 0:35–1:05 | Type `kuch theek nahi lag raha` → follow-up → answer `papa ko 2 din se bukhar hai` | "Vague requests get one targeted follow-up in the same language, never an endless loop." |
| 1:05–1:35 | Recommendation card, assessment, caregiver cards with reasons | "Medic home visit, same day. Each caregiver passed hard filters for radius, skill, tier and availability. The reason explains the score." |
| 1:35–2:00 | **Book (demo)** → choose slot → confirm → cancel | "Booking checks the caregiver's window and blocks double booking. The ID is clearly marked as a demo." |
| 2:00–2:15 | Toggle **हिं**, click a Hindi example | "The interface and voice switch to Hindi; mic and speaker support conversational input." |
| 2:15–2:45 | Type `seene mein dard aur saans phool rahi hai` | "Chest pain and breathlessness trigger the safety screen first: call 112, no caregivers, contract red flags. Emergency assistance shows demo hospitals with no dispatch." |
| 2:45–3:00 | Terminal: `benchmark_eval.py` output | "Offline: 56/56 emergencies, 39/39 follow-ups, 84% top-1 matching, with an honest overfitting caveat in the write-up." |
