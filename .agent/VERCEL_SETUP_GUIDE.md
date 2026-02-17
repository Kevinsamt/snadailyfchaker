# 🚀 Cara Set Environment Variables di Vercel

## 📋 Step-by-Step Guide

### **Step 1: Buka Vercel Dashboard**
1. Go to: https://vercel.com/dashboard
2. Login dengan akun Cak
3. Pilih project: **snadailyfchaker**

---

### **Step 2: Masuk ke Settings**
1. Klik tab **Settings** (di menu atas)
2. Scroll ke bagian **Environment Variables**
3. Atau langsung ke: https://vercel.com/[username]/snadailyfchaker/settings/environment-variables

---

### **Step 3: Add Environment Variables**

Copy-paste variable di bawah ini **SATU PER SATU**:

#### 🔐 **Variable 1: JWT_SECRET**
```
Name:  JWT_SECRET
Value: qQfj28YNInd7iI1s5WgQ4gYQltHF2RfYizjXgnod6P8=
Environment: Production, Preview, Development (centang semua)
```
**Klik "Add"**

---

#### 🔐 **Variable 2: ADMIN_USER**
```
Name:  ADMIN_USER
Value: kevinsamuel_admin
Environment: Production, Preview, Development (centang semua)
```
**Klik "Add"**

---

#### 🔐 **Variable 3: ADMIN_PASSWORD**
```
Name:  ADMIN_PASSWORD
Value: SnaDaily2026!Secure
Environment: Production, Preview, Development (centang semua)
```
**Klik "Add"**

---

#### 🌍 **Variable 4: NODE_ENV**
```
Name:  NODE_ENV
Value: production
Environment: Production (centang Production aja)
```
**Klik "Add"**

---

### **Step 4: Verify Existing Variables**

Pastikan variable ini **SUDAH ADA** (jangan tambah lagi kalau sudah ada):
- ✅ `DATABASE_URL` atau `POSTGRES_URL`
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_SERVICE_ROLE_KEY` atau `SUPABASE_ANON_KEY`

Kalau belum ada, berarti ada masalah dengan setup database/storage sebelumnya.

---

### **Step 5: Redeploy**

Setelah semua variable ditambahkan:

1. **Option A - Automatic (Recommended):**
   - Vercel akan otomatis redeploy setelah Cak save environment variables
   - Tunggu 1-2 menit

2. **Option B - Manual:**
   - Klik tab **Deployments**
   - Klik titik tiga (...) di deployment terakhir
   - Pilih **Redeploy**

---

### **Step 6: Test Login Admin**

Setelah deployment selesai:

1. Buka: https://snadailyfchaker.vercel.app/admin.html
2. Login dengan credentials BARU:
   ```
   Username: kevinsamuel_admin
   Password: SnaDaily2026!Secure
   ```
3. Kalau berhasil login → **SUCCESS!** ✅
4. Kalau gagal → cek console browser untuk error message

---

## ⚠️ **PENTING - Simpan Credentials Ini!**

**Admin Login (NEW):**
```
URL:      https://snadailyfchaker.vercel.app/admin.html
Username: kevinsamuel_admin
Password: SnaDaily2026!Secure
```

**⚠️ JANGAN SHARE KE SIAPAPUN!**

---

## 🔒 **Security Notes**

1. **Default credentials tidak akan work lagi** setelah env vars di-set
2. **JWT tokens akan lebih secure** dengan secret yang baru
3. **Kalau lupa password**, Cak harus update `ADMIN_PASSWORD` di Vercel lagi
4. **Backup credentials** di tempat yang aman (password manager recommended)

---

## 🆘 **Troubleshooting**

### Problem: "Server Configuration Error"
**Solution:** 
- Pastikan `JWT_SECRET` sudah di-set di Vercel
- Tunggu 1-2 menit setelah set env vars
- Clear browser cache (Ctrl + Shift + Delete)

### Problem: "Invalid Admin Credentials"
**Solution:**
- Double-check username & password (case-sensitive!)
- Pastikan `ADMIN_USER` dan `ADMIN_PASSWORD` sudah di-set di Vercel
- Coba logout dan login lagi

### Problem: "Database connection error"
**Solution:**
- Cek `DATABASE_URL` atau `POSTGRES_URL` masih valid
- Test koneksi database di Supabase/Neon dashboard

---

## ✅ **Checklist Setelah Set Env Vars**

- [ ] JWT_SECRET added
- [ ] ADMIN_USER added
- [ ] ADMIN_PASSWORD added
- [ ] NODE_ENV added
- [ ] Deployment completed successfully
- [ ] Admin login tested with NEW credentials
- [ ] User registration tested
- [ ] Contest registration tested
- [ ] Payment info displays correctly

---

**Need Help?** Contact developer atau check logs di Vercel Dashboard → Deployments → View Function Logs
