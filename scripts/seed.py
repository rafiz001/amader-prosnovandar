#!/usr/bin/env python3
"""Seed demo classes, subjects, chapters and questions.

Safe to re-run: classes/subjects/chapters/question types use their natural
unique keys, and a question is skipped when the same text already exists in
the subject.

Usage:
    python3 scripts/seed.py                 # uses ./data/questionbank.sqlite
    DB_PATH=/path/to/db.sqlite python3 scripts/seed.py
"""

import os
import sqlite3
import sys
import unicodedata

DB_PATH = os.environ.get("DB_PATH", "./data/questionbank.sqlite")

DEFAULT_TYPES = (("MCQ", "mcq"), ("True/False", "true_false"), ("Plain", "text"))
TYPE_NAMES = {"mcq": "MCQ", "true_false": "True/False", "text": "Plain"}


def norm(value):
    return unicodedata.normalize("NFC", value).strip()


CLASSES = [
    {
        "name": "ষষ্ঠ",
        "description": "ষষ্ঠ শ্রেণির প্রশ্নব্যাংক",
        "subjects": [
            {
                "name": "বাংলা",
                "code": "BAN",
                "chapters": ["ব্যাকরণ", "গদ্য ও পদ্য"],
                "questions": [
                    {
                        "chapter": "ব্যাকরণ",
                        "kind": "mcq",
                        "text": "‘সূর্য’ শব্দের সমার্থক শব্দ কোনটি?",
                        "options": ["চাঁদ", "রবি", "তারা", "আকাশ"],
                        "correct": 2,
                        "description": "‘রবি’ শব্দের অর্থ সূর্য।",
                        "difficulty": "easy",
                    },
                    {
                        "chapter": "ব্যাকরণ",
                        "kind": "true_false",
                        "text": "‘বই’ একটি বিশেষ্য পদ।",
                        "answer": True,
                        "description": "বই একটি বস্তুর নাম, তাই এটি বিশেষ্য।",
                        "difficulty": "easy",
                    },
                    {
                        "chapter": "গদ্য ও পদ্য",
                        "kind": "text",
                        "text": "‘পরিশ্রম’ শব্দটি দিয়ে একটি বাক্য রচনা করো।",
                        "answer": "পরিশ্রম সৌভাগ্যের প্রসূত।",
                        "marks": 2,
                    },
                ],
            },
            {
                "name": "English",
                "code": "ENG",
                "lang": "en",
                "chapters": ["Grammar", "Reading"],
                "questions": [
                    {
                        "chapter": "Grammar",
                        "kind": "mcq",
                        "text": "Choose the correct article: She is ___ honest girl.",
                        "options": ["a", "an", "the", "no article"],
                        "correct": 2,
                        "description": "‘Honest’ starts with a vowel sound, so ‘an’ is used.",
                        "difficulty": "easy",
                        "lang": "en",
                    },
                    {
                        "chapter": "Grammar",
                        "kind": "true_false",
                        "text": "“He go to school every day” is grammatically correct.",
                        "answer": False,
                        "description": "The correct form is “He goes to school every day”.",
                        "difficulty": "easy",
                        "lang": "en",
                    },
                    {
                        "chapter": "Reading",
                        "kind": "text",
                        "text": "Write a short paragraph (3–4 sentences) about your favourite hobby.",
                        "marks": 5,
                        "lang": "en",
                    },
                ],
            },
            {
                "name": "গণিত",
                "code": "MATH",
                "chapters": ["সংখ্যা", "ভগ্নাংশ"],
                "questions": [
                    {
                        "chapter": "সংখ্যা",
                        "kind": "mcq",
                        "text": "কোন সংখ্যাটি মৌলিক সংখ্যা?",
                        "options": ["1", "9", "11", "15"],
                        "correct": 3,
                        "description": "১১-এর গুণনীয়ক কেবল ১ ও ১১।",
                        "difficulty": "easy",
                    },
                    {
                        "chapter": "ভগ্নাংশ",
                        "kind": "mcq",
                        "text": r"$\frac{3}{4} + \frac{1}{4}$ এর মান কত?",
                        "options": [r"$\frac{1}{2}$", "1", r"$\frac{3}{4}$", "2"],
                        "correct": 2,
                        "description": r"$\frac{3}{4} + \frac{1}{4} = \frac{4}{4} = 1$।",
                        "difficulty": "easy",
                    },
                    {
                        "chapter": "সংখ্যা",
                        "kind": "true_false",
                        "text": "০ একটি জোড় সংখ্যা।",
                        "answer": True,
                        "description": "০-কে ২ দিয়ে নিঃশেষে ভাগ করা যায়, তাই এটি জোড় সংখ্যা।",
                        "difficulty": "easy",
                    },
                ],
            },
            {
                "name": "বিজ্ঞান",
                "code": "SCI",
                "chapters": ["জীবজগৎ", "পদার্থ ও শক্তি"],
                "questions": [
                    {
                        "chapter": "জীবজগৎ",
                        "kind": "mcq",
                        "text": "কোষের শক্তিঘর বলা হয় কোনটিকে?",
                        "options": ["নিউক্লিয়াস", "মাইটোকন্ড্রিয়া", "রাইবোজোম", "কোষঝিল্লি"],
                        "correct": 2,
                        "description": "মাইটোকন্ড্রিয়ায় শ্বসন প্রক্রিয়ায় শক্তি উৎপন্ন হয়।",
                        "difficulty": "easy",
                    },
                    {
                        "chapter": "পদার্থ ও শক্তি",
                        "kind": "true_false",
                        "text": "সূর্য একটি নক্ষত্র।",
                        "answer": True,
                        "description": "সূর্য নিজেই আলো ও তাপ উৎপন্ন করে, তাই এটি নক্ষত্র।",
                        "difficulty": "easy",
                    },
                    {
                        "chapter": "জীবজগৎ",
                        "kind": "text",
                        "text": "উদ্ভিদ কীভাবে খাদ্য তৈরি করে?",
                        "answer": "সালোকসংশ্লেষণ প্রক্রিয়ায় ক্লোরোফিলের সাহায্যে সূর্যালোক, পানি ও কার্বন ডাই-অক্সাইড থেকে খাদ্য তৈরি করে।",
                        "marks": 3,
                    },
                ],
            },
        ],
    },
    {
        "name": "সপ্তম",
        "description": "সপ্তম শ্রেণির প্রশ্নব্যাংক",
        "subjects": [
            {
                "name": "বাংলা",
                "code": "BAN",
                "chapters": ["ব্যাকরণ", "সাহিত্য"],
                "questions": [
                    {
                        "chapter": "ব্যাকরণ",
                        "kind": "mcq",
                        "text": "‘বিদ্যালয়’ শব্দের সন্ধি বিচ্ছেদ কী?",
                        "options": ["বিদ্যা + আলয়", "বিদ্য + আলয়", "বিদ্যা + লয়", "বিদ + আলয়"],
                        "correct": 1,
                        "description": "বিদ্যা + আলয় = বিদ্যালয় (অ + আ = আ)।",
                        "difficulty": "medium",
                    },
                    {
                        "chapter": "ব্যাকরণ",
                        "kind": "true_false",
                        "text": "‘সে বই পড়ে’ বাক্যে ‘পড়ে’ ক্রিয়া পদ।",
                        "answer": True,
                        "description": "‘পড়ে’ কাজ বোঝাচ্ছে, তাই এটি ক্রিয়া পদ।",
                        "difficulty": "easy",
                    },
                    {
                        "chapter": "সাহিত্য",
                        "kind": "text",
                        "text": "‘মাতা’ শব্দের দুটি সমার্থক শব্দ লেখো।",
                        "answer": "জননী, মা।",
                    },
                ],
            },
            {
                "name": "English",
                "code": "ENG",
                "lang": "en",
                "chapters": ["Grammar", "Vocabulary"],
                "questions": [
                    {
                        "chapter": "Grammar",
                        "kind": "mcq",
                        "text": "Choose the correct past tense of ‘go’.",
                        "options": ["goed", "gone", "went", "going"],
                        "correct": 3,
                        "description": "‘Went’ is the simple past form of ‘go’.",
                        "difficulty": "easy",
                        "lang": "en",
                    },
                    {
                        "chapter": "Grammar",
                        "kind": "true_false",
                        "text": "A noun is a naming word.",
                        "answer": True,
                        "description": "Nouns name people, places, things or ideas.",
                        "difficulty": "easy",
                        "lang": "en",
                    },
                    {
                        "chapter": "Vocabulary",
                        "kind": "text",
                        "text": "Use the word ‘beautiful’ in a sentence of your own.",
                        "answer": "The garden looks beautiful in spring.",
                        "lang": "en",
                    },
                ],
            },
            {
                "name": "গণিত",
                "code": "MATH",
                "chapters": ["পূর্ণসংখ্যা", "বীজগণিত"],
                "questions": [
                    {
                        "chapter": "পূর্ণসংখ্যা",
                        "kind": "mcq",
                        "text": r"$-7 + 12$ এর মান কত?",
                        "options": ["-19", "5", "19", "-5"],
                        "correct": 2,
                        "description": r"$-7 + 12 = 5$।",
                        "difficulty": "easy",
                    },
                    {
                        "chapter": "বীজগণিত",
                        "kind": "mcq",
                        "text": "যদি $x = 3$ হয়, তবে $2x + 5$ এর মান কত?",
                        "options": ["6", "8", "11", "16"],
                        "correct": 3,
                        "description": r"$2 \times 3 + 5 = 11$।",
                        "difficulty": "medium",
                    },
                    {
                        "chapter": "পূর্ণসংখ্যা",
                        "kind": "true_false",
                        "text": "দুটি ঋণাত্মক সংখ্যার গুণফল ঋণাত্মক হয়।",
                        "answer": False,
                        "description": "দুটি ঋণাত্মক সংখ্যার গুণফল সবসময় ধনাত্মক।",
                        "difficulty": "medium",
                    },
                ],
            },
            {
                "name": "বিজ্ঞান",
                "code": "SCI",
                "chapters": ["পরিবেশ ও বাস্তুতন্ত্র", "পদার্থের অবস্থা"],
                "questions": [
                    {
                        "chapter": "পরিবেশ ও বাস্তুতন্ত্র",
                        "kind": "mcq",
                        "text": "কোনটি নবায়নযোগ্য শক্তির উৎস?",
                        "options": ["কয়লা", "প্রাকৃতিক গ্যাস", "সৌরশক্তি", "পেট্রোল"],
                        "correct": 3,
                        "description": "সৌরশক্তি প্রকৃতিতে পুনরায় উৎপন্ন হয়।",
                        "difficulty": "easy",
                    },
                    {
                        "chapter": "পরিবেশ ও বাস্তুতন্ত্র",
                        "kind": "true_false",
                        "text": "জলচক্র পরিচালনার প্রধান শক্তি সূর্য।",
                        "answer": True,
                        "description": "সূর্যের তাপে পানি বাষ্পীভূত হয়ে জলচক্র সম্পন্ন হয়।",
                        "difficulty": "medium",
                    },
                    {
                        "chapter": "পদার্থের অবস্থা",
                        "kind": "text",
                        "text": "বায়ু দূষণের দুটি কারণ লেখো।",
                        "answer": "যানবাহনের ধোঁয়া ও কারখানার নির্গত ধোঁয়া।",
                        "marks": 2,
                    },
                ],
            },
        ],
    },
    {
        "name": "অষ্টম",
        "description": "অষ্টম শ্রেণির প্রশ্নব্যাংক",
        "subjects": [
            {
                "name": "বাংলা",
                "code": "BAN",
                "chapters": ["ব্যাকরণ", "গদ্য"],
                "questions": [
                    {
                        "chapter": "ব্যাকরণ",
                        "kind": "mcq",
                        "text": "‘অগ্নি’ শব্দের সমার্থক শব্দ কোনটি?",
                        "options": ["অনল", "জল", "বায়ু", "আকাশ"],
                        "correct": 1,
                        "description": "‘অনল’ শব্দের অর্থ আগুন।",
                        "difficulty": "easy",
                    },
                    {
                        "chapter": "ব্যাকরণ",
                        "kind": "true_false",
                        "text": "‘সন্ধি’ শব্দের অর্থ মিলন।",
                        "answer": True,
                        "description": "পাশাপাশি দুই বর্ণের মিলনকে সন্ধি বলে।",
                        "difficulty": "easy",
                    },
                    {
                        "chapter": "গদ্য",
                        "kind": "text",
                        "text": "‘দৃষ্টি’ শব্দটি দিয়ে একটি বাক্য রচনা করো।",
                        "answer": "শিক্ষকের দৃষ্টি ছিল স্নেহময়।",
                    },
                ],
            },
            {
                "name": "English",
                "code": "ENG",
                "lang": "en",
                "chapters": ["Tense", "Composition"],
                "questions": [
                    {
                        "chapter": "Tense",
                        "kind": "mcq",
                        "text": "She ___ in Dhaka since 2018.",
                        "options": ["live", "lives", "has lived", "living"],
                        "correct": 3,
                        "description": "‘Since’ with a past starting point takes the present perfect.",
                        "difficulty": "medium",
                        "lang": "en",
                    },
                    {
                        "chapter": "Tense",
                        "kind": "true_false",
                        "text": "“I am knowing the answer” is correct English.",
                        "answer": False,
                        "description": "The correct sentence is “I know the answer”.",
                        "difficulty": "medium",
                        "lang": "en",
                    },
                    {
                        "chapter": "Composition",
                        "kind": "text",
                        "text": "Write the past participle form of the verb ‘write’.",
                        "answer": "written",
                        "difficulty": "easy",
                        "lang": "en",
                    },
                ],
            },
            {
                "name": "গণিত",
                "code": "MATH",
                "chapters": ["জ্যামিতি", "পরিমাপ"],
                "questions": [
                    {
                        "chapter": "জ্যামিতি",
                        "kind": "mcq",
                        "text": "একটি ত্রিভুজের তিন কোণের সমষ্টি কত ডিগ্রি?",
                        "options": ["90", "180", "270", "360"],
                        "correct": 2,
                        "description": "ত্রিভুজের অন্তঃস্থ তিন কোণের সমষ্টি ১৮০°।",
                        "difficulty": "easy",
                    },
                    {
                        "chapter": "পরিমাপ",
                        "kind": "mcq",
                        "text": "বৃত্তের পরিধির সূত্র কোনটি? ($r$ = ব্যাসার্ধ)",
                        "options": [r"$2\pi r$", r"$\pi r^2$", r"$2r$", r"$\pi r$"],
                        "correct": 1,
                        "description": r"বৃত্তের পরিধি $2\pi r$ এবং ক্ষেত্রফল $\pi r^2$।",
                        "difficulty": "medium",
                    },
                    {
                        "chapter": "জ্যামিতি",
                        "kind": "true_false",
                        "text": "প্রতিটি বর্গক্ষেত্র একটি আয়তক্ষেত্র।",
                        "answer": True,
                        "description": "বর্গক্ষেত্রের চার কোণই সমকোণ, তাই এটি আয়তক্ষেত্রের একটি বিশেষ রূপ।",
                        "difficulty": "medium",
                    },
                ],
            },
            {
                "name": "বিজ্ঞান",
                "code": "SCI",
                "chapters": ["মানবদেহ", "রাসায়নিক বিক্রিয়া"],
                "questions": [
                    {
                        "chapter": "মানবদেহ",
                        "kind": "mcq",
                        "text": "মানবদেহের সবচেয়ে বড় অঙ্গ কোনটি?",
                        "options": ["যকৃত", "ত্বক", "ফুসফুস", "মস্তিষ্ক"],
                        "correct": 2,
                        "description": "ত্বক আয়তন ও ওজনে মানবদেহের সবচেয়ে বড় অঙ্গ।",
                        "difficulty": "easy",
                    },
                    {
                        "chapter": "মানবদেহ",
                        "kind": "true_false",
                        "text": "রক্তে অক্সিজেন বহন করে লোহিত রক্তকণিকা।",
                        "answer": True,
                        "description": "হিমোগ্লোবিনের মাধ্যমে লোহিত রক্তকণিকা অক্সিজেন পরিবহন করে।",
                        "difficulty": "easy",
                    },
                    {
                        "chapter": "রাসায়নিক বিক্রিয়া",
                        "kind": "text",
                        "text": "সালোকসংশ্লেষণের সমীকরণ লেখো।",
                        "answer": r"$6CO_2 + 6H_2O \rightarrow C_6H_{12}O_6 + 6O_2$",
                        "difficulty": "hard",
                        "marks": 5,
                    },
                ],
            },
        ],
    },
    {
        "name": "নবম",
        "description": "নবম শ্রেণির প্রশ্নব্যাংক",
        "subjects": [
            {
                "name": "বাংলা",
                "code": "BAN",
                "chapters": ["ব্যাকরণ", "উপন্যাস"],
                "questions": [
                    {
                        "chapter": "উপন্যাস",
                        "kind": "mcq",
                        "text": "‘পদ্মা নদীর মাঝি’ উপন্যাসের রচয়িতা কে?",
                        "options": [
                            "মানিক বন্দ্যোপাধ্যায়",
                            "রবীন্দ্রনাথ ঠাকুর",
                            "শরৎচন্দ্র চট্টোপাধ্যায়",
                            "জীবনানন্দ দাশ",
                        ],
                        "correct": 1,
                        "description": "‘পদ্মা নদীর মাঝি’ মানিক বন্দ্যোপাধ্যায়ের বিখ্যাত উপন্যাস।",
                        "difficulty": "medium",
                    },
                    {
                        "chapter": "ব্যাকরণ",
                        "kind": "true_false",
                        "text": "‘কারক’ বাংলা ব্যাকরণের একটি বিষয়।",
                        "answer": True,
                        "description": "ক্রিয়ার সঙ্গে বাক্যের অন্যান্য পদের সম্পর্ককে কারক বলে।",
                        "difficulty": "easy",
                    },
                    {
                        "chapter": "উপন্যাস",
                        "kind": "text",
                        "text": "‘সোনার তরী’ কাব্যগ্রন্থের রচয়িতা কে?",
                        "answer": "রবীন্দ্রনাথ ঠাকুর।",
                        "difficulty": "easy",
                    },
                ],
            },
            {
                "name": "English",
                "code": "ENG",
                "lang": "en",
                "chapters": ["Grammar", "Writing"],
                "questions": [
                    {
                        "chapter": "Grammar",
                        "kind": "mcq",
                        "text": "Choose the correct passive form: “They built the bridge.”",
                        "options": [
                            "The bridge was built by them.",
                            "The bridge is built by them.",
                            "The bridge built by them.",
                            "The bridge has built by them.",
                        ],
                        "correct": 1,
                        "description": "Simple past passive uses was/were + past participle.",
                        "difficulty": "medium",
                        "lang": "en",
                    },
                    {
                        "chapter": "Grammar",
                        "kind": "true_false",
                        "text": "An adverb modifies a verb, an adjective, or another adverb.",
                        "answer": True,
                        "description": "Adverbs describe how, when, where or to what degree.",
                        "difficulty": "easy",
                        "lang": "en",
                    },
                    {
                        "chapter": "Writing",
                        "kind": "text",
                        "text": "Write a paragraph on ‘Your Aim in Life’.",
                        "marks": 10,
                        "difficulty": "hard",
                        "lang": "en",
                    },
                ],
            },
            {
                "name": "গণিত",
                "code": "MATH",
                "chapters": ["বাস্তব সংখ্যা", "সমীকরণ"],
                "questions": [
                    {
                        "chapter": "বাস্তব সংখ্যা",
                        "kind": "mcq",
                        "text": r"$\sqrt{2}$ কোন ধরনের সংখ্যা?",
                        "options": ["মূলদ", "অমূলদ", "পূর্ণসংখ্যা", "স্বাভাবিক"],
                        "correct": 2,
                        "description": r"$\sqrt{2}$-কে ভগ্নাংশ আকারে লেখা যায় না, তাই এটি অমূলদ।",
                        "difficulty": "medium",
                    },
                    {
                        "chapter": "সমীকরণ",
                        "kind": "mcq",
                        "text": r"$x^2 - 5x + 6 = 0$ সমীকরণের মূল দুটি কী?",
                        "options": ["2, 3", "-2, -3", "1, 6", "-1, 6"],
                        "correct": 1,
                        "description": r"$(x-2)(x-3)=0$, তাই মূল ২ ও ৩।",
                        "difficulty": "medium",
                    },
                    {
                        "chapter": "বাস্তব সংখ্যা",
                        "kind": "true_false",
                        "text": "প্রতিটি পূর্ণসংখ্যা একটি মূলদ সংখ্যা।",
                        "answer": True,
                        "description": r"যেকোনো পূর্ণসংখ্যা $n$-কে $\frac{n}{1}$ আকারে লেখা যায়।",
                        "difficulty": "easy",
                    },
                    {
                        "chapter": "সমীকরণ",
                        "kind": "text",
                        "text": r"সমাধান করো: $2x + 3 = 11$",
                        "answer": r"$x = 4$",
                        "difficulty": "easy",
                        "marks": 2,
                    },
                ],
            },
            {
                "name": "পদার্থবিজ্ঞান",
                "code": "PHY",
                "chapters": ["গতি", "শক্তি"],
                "questions": [
                    {
                        "chapter": "গতি",
                        "kind": "mcq",
                        "text": "গতির একক কোনটি?",
                        "options": ["নিউটন", "জুল", "মিটার/সেকেন্ড", "ওয়াট"],
                        "correct": 3,
                        "description": "গতি = দূরত্ব ÷ সময়, তাই একক মিটার/সেকেন্ড।",
                        "difficulty": "easy",
                    },
                    {
                        "chapter": "শক্তি",
                        "kind": "true_false",
                        "text": "কাজ = বল × সরণ।",
                        "answer": True,
                        "description": "বলের অভিমুখে সরণ ঘটলে কাজ = বল × সরণ।",
                        "difficulty": "easy",
                    },
                    {
                        "chapter": "গতি",
                        "kind": "text",
                        "text": "নিউটনের প্রথম সূত্রটি লেখো।",
                        "answer": "বাহ্যিক বল প্রয়োগ না করলে স্থির বস্তু চিরকাল স্থির থাকে এবং চলমান বস্তু সমবেগে সরলপথে চলতে থাকে।",
                        "difficulty": "medium",
                        "marks": 3,
                    },
                ],
            },
        ],
    },
    {
        "name": "দশম",
        "description": "দশম শ্রেণির প্রশ্নব্যাংক",
        "subjects": [
            {
                "name": "গণিত",
                "code": "MATH",
                "chapters": ["ত্রিকোণমিতি", "পরিসংখ্যান"],
                "questions": [
                    {
                        "chapter": "ত্রিকোণমিতি",
                        "kind": "mcq",
                        "text": r"$\sin 30^\circ$ এর মান কত?",
                        "options": [r"$\frac{1}{2}$", r"$\frac{\sqrt{3}}{2}$", "1", "0"],
                        "correct": 1,
                        "description": r"$\sin 30^\circ = \frac{1}{2}$।",
                        "difficulty": "easy",
                    },
                    {
                        "chapter": "ত্রিকোণমিতি",
                        "kind": "true_false",
                        "text": r"$\sin^2\theta + \cos^2\theta = 1$।",
                        "answer": True,
                        "description": "এটি ত্রিকোণমিতির মৌলিক অভেদ।",
                        "difficulty": "medium",
                    },
                    {
                        "chapter": "পরিসংখ্যান",
                        "kind": "text",
                        "text": "উপাত্তের সর্বোচ্চ ও সর্বনিম্ন মানের বিয়োগফলকে কী বলে?",
                        "answer": "পরিসর (Range)।",
                        "difficulty": "easy",
                    },
                ],
            },
            {
                "name": "পদার্থবিজ্ঞান",
                "code": "PHY",
                "chapters": ["চল বিদ্যুৎ", "আলো"],
                "questions": [
                    {
                        "chapter": "চল বিদ্যুৎ",
                        "kind": "mcq",
                        "text": "ওহমের সূত্র অনুযায়ী কোনটি সঠিক?",
                        "options": ["V = IR", "V = I/R", "I = VR", "R = VI"],
                        "correct": 1,
                        "description": "স্থির তাপমাত্রায় V = IR।",
                        "difficulty": "easy",
                    },
                    {
                        "chapter": "আলো",
                        "kind": "true_false",
                        "text": "উত্তল লেন্স আলো অভিসারী করে।",
                        "answer": True,
                        "description": "উত্তল লেন্স সমান্তরাল রশ্মিকে এক বিন্দুতে মিলিত করে।",
                        "difficulty": "medium",
                    },
                    {
                        "chapter": "চল বিদ্যুৎ",
                        "kind": "text",
                        "text": "বিদ্যুৎ প্রবাহের SI একক কী?",
                        "answer": "অ্যাম্পিয়ার (A)।",
                        "difficulty": "easy",
                    },
                ],
            },
        ],
    },
]


def get_or_create_class(cur, name, description):
    name = norm(name)
    cur.execute(
        "INSERT OR IGNORE INTO classes (name, description) VALUES (?, ?)",
        (name, description),
    )
    return cur.execute("SELECT id FROM classes WHERE name = ?", (name,)).fetchone()[0]


def get_or_create_subject(cur, class_id, name, code):
    name = norm(name)
    cur.execute(
        "INSERT OR IGNORE INTO subjects (class_id, name, code) VALUES (?, ?, ?)",
        (class_id, name, code),
    )
    subject_id = cur.execute(
        "SELECT id FROM subjects WHERE class_id = ? AND name = ?", (class_id, name)
    ).fetchone()[0]
    for type_name, kind in DEFAULT_TYPES:
        cur.execute(
            "INSERT OR IGNORE INTO question_types (subject_id, name, kind) VALUES (?, ?, ?)",
            (subject_id, type_name, kind),
        )
    return subject_id


def get_or_create_chapter(cur, subject_id, name, position):
    name = norm(name)
    cur.execute(
        "INSERT OR IGNORE INTO chapters (subject_id, name, position) VALUES (?, ?, ?)",
        (subject_id, name, position),
    )
    return cur.execute(
        "SELECT id FROM chapters WHERE subject_id = ? AND name = ?", (subject_id, name)
    ).fetchone()[0]


def insert_question(cur, subject_id, q, lang_default):
    text = norm(q["text"])
    if cur.execute(
        "SELECT 1 FROM questions WHERE subject_id = ? AND text = ?", (subject_id, text)
    ).fetchone():
        return False

    kind = q["kind"]
    type_id = cur.execute(
        "SELECT id FROM question_types WHERE subject_id = ? AND name = ?",
        (subject_id, TYPE_NAMES[kind]),
    ).fetchone()[0]

    chapter_id = None
    if q.get("chapter"):
        chapter_id = cur.execute(
            "SELECT id FROM chapters WHERE subject_id = ? AND name = ?",
            (subject_id, norm(q["chapter"])),
        ).fetchone()[0]

    options = [norm(o) for o in q.get("options", ["", "", "", ""])]
    correct = None
    if kind == "mcq":
        assert len(options) == 4 and all(options), f"MCQ needs 4 options: {text}"
        correct = q["correct"]
        assert 1 <= correct <= 4, f"correct must be 1-4: {text}"
        answer = options[correct - 1]
    elif kind == "true_false":
        value = q["answer"]
        if isinstance(value, str):
            value = value.strip().lower() in {"true", "t", "yes", "y", "1"}
        answer = "true" if value else "false"
    else:
        answer = q.get("answer", "")

    cur.execute(
        """INSERT INTO questions
           (subject_id, chapter_id, type_id, text, math, option_1, option_2, option_3, option_4,
            correct_option, answer, description, marks, difficulty, lang)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            subject_id,
            chapter_id,
            type_id,
            text,
            q.get("math", ""),
            options[0] or None,
            options[1] or None,
            options[2] or None,
            options[3] or None,
            correct,
            answer,
            q.get("description", ""),
            q.get("marks", 1),
            q.get("difficulty", "medium"),
            q.get("lang", lang_default),
        ),
    )
    return True


def main():
    if not os.path.exists(DB_PATH):
        sys.exit(f"database not found: {DB_PATH} (start the server once to create it)")

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    added = 0
    with conn:
        cur = conn.cursor()
        for cls in CLASSES:
            class_id = get_or_create_class(cur, cls["name"], cls.get("description", ""))
            for subj in cls["subjects"]:
                subject_id = get_or_create_subject(
                    cur, class_id, subj["name"], subj.get("code", "")
                )
                for position, chapter in enumerate(subj["chapters"], start=1):
                    get_or_create_chapter(cur, subject_id, chapter, position)
                for q in subj["questions"]:
                    if insert_question(cur, subject_id, q, subj.get("lang", "bn")):
                        added += 1
    conn.close()
    print(f"Seeded {added} new question(s) into {DB_PATH}")


if __name__ == "__main__":
    main()
