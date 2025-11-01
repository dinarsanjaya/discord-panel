# Discord Bot Dashboard

Dashboard web untuk mengelola multiple Discord bot dengan fitur auto-reply menggunakan Google Gemini AI atau pesan custom.

## Features

- **Multi-Bot Management**: Kelola beberapa Discord bot token sekaligus
- **Google Gemini Integration**: Auto-reply menggunakan AI Google Gemini
- **Custom Message Mode**: Kirim pesan dari file pesan.txt secara acak
- **Real-time Monitoring**: Live log untuk tracking aktivitas bot
- **Task Management**: Buat dan kelola multiple task untuk channel berbeda
- **Token Validation**: Validasi Discord token sebelum menyimpan
- **Flexible Settings**: Konfigurasi interval, delay, bahasa, dan reply mode per task
- **Auto-Delete**: Opsi untuk menghapus pesan bot setelah waktu tertentu

## Tech Stack

- **Backend**: Flask (Python)
- **Frontend**: Bootstrap 5, Bootstrap Icons
- **AI Integration**: Google Generative AI (Gemini)
- **API**: Discord API

## Prerequisites

- Python 3.8 atau lebih tinggi
- Discord Bot Token(s)
- Google Gemini API Key (opsional, untuk mode AI)

## Installation

1. Clone repository ini:
```bash
git clone <repository-url>
cd discord-panel
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Buat file `config.json` (otomatis dibuat saat pertama kali run):
```json
{
    "discord_tokens": [],
    "google_api_keys": [],
    "tasks": []
}
```

4. (Opsional) Buat file `.env` untuk konfigurasi environment:
```env
DISCORD_TOKENS=token1,token2,token3
GOOGLE_API_KEYS=key1,key2,key3
```

5. Buat file `pesan.txt` untuk mode custom message:
```
Pesan pertama
Pesan kedua
Pesan ketiga
```

## Usage

1. Jalankan aplikasi:
```bash
python app.py
```

2. Buka browser dan akses:
```
http://localhost:5005
```

3. Tambahkan Discord Token:
   - Klik tombol "Add Token"
   - Paste Discord bot token Anda
   - Token akan divalidasi secara otomatis

4. Tambahkan Google API Key (untuk mode Gemini):
   - Klik tombol "Add Key"
   - Paste API key dari [Google AI Studio](https://aistudio.google.com/app/apikey)

5. Buat Task Baru:
   - Masukkan Channel ID target
   - Pilih akun bot yang akan digunakan
   - Klik "Buat Tugas"

6. Konfigurasi Task:
   - **Mode**: Pilih "Gemini" (AI) atau "pesan.txt" (custom message)
   - **Delay Baca**: Waktu delay untuk membaca pesan (mode Gemini)
   - **Interval Kirim**: Jeda waktu antar pengiriman pesan
   - **Bahasa**: Pilih bahasa untuk response AI
   - **Kirim Reply**: Toggle untuk reply ke pesan atau kirim biasa
   - **Hapus Balasan**: Auto-delete pesan bot setelah waktu tertentu

7. Start/Stop Task:
   - Klik "Start" untuk menjalankan bot
   - Klik "Stop" untuk menghentikan bot
   - Monitor aktivitas di Live Log

## Configuration

### Mode Gemini (AI)
- Menggunakan Google Gemini AI untuk generate response
- Bot akan membaca pesan di channel dan merespon dengan AI
- Delay baca mengatur jeda sebelum bot merespon
- Support bahasa Indonesia dan English

### Mode pesan.txt
- Bot akan mengirim pesan random dari file `pesan.txt`
- Setiap baris di `pesan.txt` adalah satu pesan
- Klik tombol refresh untuk reload isi file tanpa restart

### Auto-Delete Feature
- **Hapus Balasan**: Masukkan waktu dalam detik untuk auto-delete
- **Langsung**: Jika dicentang, pesan akan langsung dihapus setelah dikirim
- Kosongkan field untuk disable auto-delete

## Mendapatkan Discord Token

1. Buka Discord di browser (bukan aplikasi desktop)
2. Login dengan akun bot Anda
3. Simpan Script ini di bookmark
4. Klik
5. Copy langsung paste nanti di localhost

```javascript
javascript:(()=>{var t=document.body.appendChild(document.createElement`iframe`).contentWindow.localStorage.token.replace(/["]+/g, '');prompt('Get Selfbot Discord Token by github.com/vsec7', t)})();
```

6. Copy token yang muncul

**Warning**: Jangan share token Anda ke siapapun!

## Mendapatkan Channel ID

1. Buka Discord User Settings
2. Pergi ke "Advanced"
3. Enable "Developer Mode"
4. Right-click pada channel yang ingin Anda target
5. Klik "Copy Channel ID"

## File Structure

```
discord-panel/
├── app.py              # Main Flask application
├── bot_logic.py        # Bot auto-reply logic
├── config.json         # Configuration file (auto-generated)
├── pesan.txt          # Custom messages file
├── requirements.txt    # Python dependencies
├── templates/
│   └── index.html     # Main dashboard HTML
├── static/
│   ├── css/
│   │   └── style.css  # Custom styles
│   └── js/
│       └── script.js  # Frontend JavaScript
└── README.md          # This file
```

## API Endpoints

- `GET /` - Dashboard utama
- `GET /logs` - Server-Sent Events untuk live log
- `POST /save_config` - Simpan konfigurasi
- `POST /start_bot` - Start bot task
- `POST /stop_bot` - Stop bot task
- `POST /refresh_pesan` - Refresh pesan.txt cache

## Troubleshooting

### Bot tidak bisa start
- Pastikan token Discord valid dan tidak expired
- Check apakah bot memiliki permission di channel target
- Lihat Live Log untuk error details

### Token invalid
- Token mungkin expired, generate token baru
- Pastikan format token benar
- Verifikasi bot masih aktif di Discord Developer Portal

### Mode Gemini tidak response
- Pastikan Google API Key valid
- Check quota API key di [Google AI Studio](https://aistudio.google.com/app/apikey)
- Pastikan delay baca tidak terlalu kecil

### Pesan tidak terkirim
- Verify Channel ID benar
- Pastikan bot memiliki permission "Send Messages"
- Check rate limit Discord

## Security Notes

- Jangan commit file `config.json` ke repository
- Simpan token dan API key dengan aman
- Gunakan `.env` file untuk production
- Enable Developer Mode hanya saat diperlukan
- Jangan share token atau API key ke siapapun

## Credits

Made by **SHARE IT HUB**

Official Links:
- GitHub: [shareithub](https://github.com/shareithub)
- Telegram Channel: [SHAREITHUB_COM](https://t.me/SHAREITHUB_COM)
- YouTube: [@shareithub_com](https://www.youtube.com/@shareithub_com)
- Bot LAPAK SWAP: [LapakSwap_bot](https://t.me/LapakSwap_bot)
- Channel LAPAK SWAP: [lapak_swap](https://t.me/lapak_swap)

## License

This project is for educational purposes only. Use at your own risk.

## Disclaimer

Penggunaan bot untuk spam atau activity yang melanggar Discord Terms of Service adalah tanggung jawab pengguna. Developer tidak bertanggung jawab atas penyalahgunaan tool ini.


