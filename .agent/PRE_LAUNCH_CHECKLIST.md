# 🚀 Pre-Launch Security Checklist - SnaDaily Fish Contest

**Project:** SnaDaily Fish Authenticity & Contest Platform  
**Target Launch:** Before Public Registration Opens  
**Last Updated:** 17 February 2026

---

## 🔐 CRITICAL - Must Complete Before Launch

### 1. Environment Variables (Vercel Dashboard)

**Location:** Vercel Dashboard → Project Settings → Environment Variables

#### ✅ Required Variables:

```bash
# JWT Secret (CRITICAL!)
JWT_SECRET=<generate_strong_random_string_min_32_chars>
# Example: openssl rand -base64 32

# Admin Credentials (CRITICAL!)
ADMIN_USER=<your_new_admin_username>
ADMIN_PASSWORD=<strong_password_min_12_chars>

# Database Connection (Should already exist)
DATABASE_URL=postgresql://user:password@host:5432/database
POSTGRES_URL=postgresql://user:password@host:5432/database

# Supabase Storage (Should already exist)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Production Environment
NODE_ENV=production
```

#### 🔧 Optional (If using shipping features):

```bash
KOMERCE_API_KEY_COST=<your_komerce_cost_api_key>
KOMERCE_API_KEY_DELIVERY=<your_komerce_delivery_api_key>
KOMERCE_ORIGIN_ID=1553
```

---

## 🧪 Testing Checklist

### User Registration & Login
- [ ] Register new user account
- [ ] Login with new account
- [ ] Verify JWT token is generated
- [ ] Check password is hashed in database
- [ ] Test password complexity validation (min 8 chars, letters + numbers)
- [ ] Test duplicate username rejection

### Contest Registration
- [ ] Upload fish photo (test MIME type validation)
- [ ] Upload fish video (test file size limit 50MB)
- [ ] Upload payment proof
- [ ] Verify all data saved to database
- [ ] Check files uploaded to Supabase storage
- [ ] Verify payment info displays correctly (0813-7359-0144, Kevin Samuel Tampubolon)

### Admin Panel
- [ ] Login as admin (with NEW credentials after setting env vars)
- [ ] View all registrations
- [ ] Update registration status (approve/reject)
- [ ] Score a registration
- [ ] Delete a registration
- [ ] View user list
- [ ] Create/edit/delete events

### Security Tests
- [ ] Try SQL injection in login form
- [ ] Try XSS attack in text inputs
- [ ] Test rate limiting (try 15+ login attempts)
- [ ] Verify CORS blocks unauthorized domains
- [ ] Test file upload with malicious file types (.exe, .php)
- [ ] Verify admin routes require authentication

---

## 📱 Frontend Checklist

### Responsive Design
- [ ] Test on mobile (320px - 480px)
- [ ] Test on tablet (768px - 1024px)
- [ ] Test on desktop (1920px+)
- [ ] Check all forms are usable on mobile
- [ ] Verify images load correctly
- [ ] Test navigation menu on all devices

### User Experience
- [ ] All buttons work correctly
- [ ] Form validation messages are clear
- [ ] Success/error messages display properly
- [ ] Loading states show during API calls
- [ ] File upload progress indicators work
- [ ] Payment instructions are clear

### Browser Compatibility
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (iOS)
- [ ] Mobile browsers (Chrome Mobile, Safari Mobile)

---

## 🎨 Content Verification

### Payment Information
- [x] E-Wallet number: **0813-7359-0144** ✅
- [x] Account name: **KEVIN SAMUEL TAMPUBOLON** ✅
- [x] ShopeePay, OVO, Dana logos display correctly ✅

### Event Information
- [ ] Event title, description, location are correct
- [ ] Event dates are accurate
- [ ] Registration tiers and prices are correct
- [ ] Contest classes are properly configured

### Legal & Compliance
- [ ] Terms & Conditions (if applicable)
- [ ] Privacy Policy (if applicable)
- [ ] Contest rules clearly stated

---

## 🔒 Security Hardening (Already Implemented)

- [x] Password hashing with bcrypt ✅
- [x] JWT authentication ✅
- [x] Rate limiting on login (10 attempts / 15 min) ✅
- [x] Input sanitization (XSS prevention) ✅
- [x] CORS protection ✅
- [x] File upload MIME type validation ✅
- [x] Helmet.js security headers ✅
- [x] SQL injection prevention (parameterized queries) ✅

---

## 🚨 Known Issues / Warnings

### Non-Critical Warnings:
- **CSP Warning**: Content Security Policy disabled for external scripts (Midtrans, etc.)
  - Status: Acceptable for current implementation
  - Impact: Browser console warning only, no functionality impact

### Default Credentials Warning:
- **Current Status**: Default admin credentials still work if env vars not set
- **Action Required**: Set `ADMIN_USER` and `ADMIN_PASSWORD` in Vercel before launch
- **Risk Level**: 🔴 HIGH if not changed

---

## 📊 Performance Checklist

- [ ] Test page load speed (should be < 3 seconds)
- [ ] Optimize images (compress if needed)
- [ ] Check database query performance
- [ ] Verify Supabase storage upload speed
- [ ] Test with slow 3G connection

---

## 🎯 Launch Day Checklist

### Before Opening Registration:
1. [ ] Verify all environment variables are set in Vercel
2. [ ] Test complete registration flow end-to-end
3. [ ] Confirm admin can access admin panel with NEW credentials
4. [ ] Check payment information is displayed correctly
5. [ ] Verify email notifications work (if implemented)
6. [ ] Test on multiple devices and browsers
7. [ ] Have backup plan ready (database backup, rollback strategy)

### After Opening Registration:
1. [ ] Monitor first 10 registrations closely
2. [ ] Check Supabase storage usage
3. [ ] Monitor database performance
4. [ ] Watch for error logs in Vercel
5. [ ] Be ready to respond to user questions

---

## 🆘 Emergency Contacts & Resources

### Important Links:
- **Live Site**: https://snadailyfchaker.vercel.app
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Supabase Dashboard**: https://app.supabase.com
- **GitHub Repo**: https://github.com/Kevinsamt/snadailyfchaker

### Quick Commands:
```bash
# Check deployment status
vercel --prod

# View logs
vercel logs

# Rollback to previous deployment
vercel rollback
```

---

## ✅ Final Sign-Off

**Before launching, confirm:**
- [ ] All CRITICAL items completed
- [ ] Testing checklist 100% passed
- [ ] Environment variables verified in Vercel
- [ ] Admin credentials changed from default
- [ ] Payment information verified
- [ ] Backup strategy in place

**Signed off by:** _________________  
**Date:** _________________  
**Ready for Launch:** ☐ YES  ☐ NO

---

**Notes:**
- Keep this checklist updated as new features are added
- Review security measures quarterly
- Update environment variables if compromised
- Monitor user feedback after launch
