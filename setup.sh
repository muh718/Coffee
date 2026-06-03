#!/bin/bash

echo -e "\n🚀 مرحباً بك في معالج إعداد Supabase الذكي 🚀\n"

# 1. Login
echo -e "1️⃣ الخطوة الأولى: تسجيل الدخول في Supabase"
echo -e "للحصول على رمز الدخول (Token)، افتح هذا الرابط في متصفحك:"
echo -e "👉 https://supabase.com/dashboard/account/tokens\n"
read -p "قم بإنشاء Token جديد، ثم انسخه والصقه هنا: " SUPABASE_TOKEN

export SUPABASE_ACCESS_TOKEN=$SUPABASE_TOKEN
npx supabase login

echo -e "\n✅ تم تسجيل الدخول بنجاح!\n"

# 2. Link Project
echo -e "2️⃣ الخطوة الثانية: ربط المشروع"
echo -e "الآن سيطلب منك كلمة مرور قاعدة البيانات (التي أنشأتها مع المشروع)."
npx supabase link --project-ref pgptpqjiloesetzhifiw

echo -e "\n✅ تم ربط المشروع بنجاح!\n"

# 3. Database Migration
echo -e "3️⃣ الخطوة الثالثة: بناء قاعدة البيانات"
echo -e "جاري إنشاء الجداول وإعدادات الأمان في قاعدة البيانات تلقائياً..."
npx supabase db push

echo -e "\n✅ تم بناء قاعدة البيانات بنجاح!\n"

# 4. Secrets
echo -e "4️⃣ الخطوة الرابعة: إعداد مفاتيح الذكاء الاصطناعي (API Keys)"
read -p "أدخل مفتاح Google Vision API (أو اضغط Enter لتخطيه مؤقتاً): " GOOGLE_KEY
read -p "أدخل مفتاح OpenAI API (أو اضغط Enter لتخطيه مؤقتاً): " OPENAI_KEY

if [ ! -z "$GOOGLE_KEY" ]; then
    npx supabase secrets set GOOGLE_VISION_API_KEY=$GOOGLE_KEY
    echo "تم حفظ مفتاح Google Vision ✅"
fi

if [ ! -z "$OPENAI_KEY" ]; then
    npx supabase secrets set OPENAI_API_KEY=$OPENAI_KEY
    echo "تم حفظ مفتاح OpenAI ✅"
fi

# 5. Deploy Edge Functions
echo -e "\n5️⃣ الخطوة الأخيرة: رفع دوال الذكاء الاصطناعي (Edge Functions)..."
npx supabase functions deploy ocr-pipeline
npx supabase functions deploy check-similar

echo -e "\n🎉 اكتمل الإعداد بنجاح! قاعدة البيانات والدوال وتطبيقك الآن جاهزة للعمل بشكل كامل. 🎉"
