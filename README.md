# Raddina Health Service

## 📌 Overview
**Raddina Health Service** is a web-based pharmacy information system designed for **pharmacies, wholesalers, pharmaceutical companies, and end customers**.  
This project integrates **AI-powered features** to enhance business workflows, accounting processes, and healthcare delivery.

The system provides:
- **Accounting automation** for pharmacists, pharmacy owners, wholesalers, and suppliers.  
- **AI-driven medicine recommendations** for patients based on their needs and medical history.  
- **Automated invoice scanning (OCR + Computer Vision)** to directly populate pharmacy databases from scanned documents.  

Our goal is to **streamline pharmaceutical operations** while improving accessibility and decision-making for healthcare professionals and customers.

---

## 🎯 Objectives
- Simplify and automate accounting processes for pharmacies and wholesalers.  
- Provide real-time inventory and transaction management.  
- Enable **AI-based medicine recommendations** for customers.  
- Support pharmacists in reducing human error in data entry using **OCR-based invoice scanning**.  
- Deliver a scalable and secure system that can integrate with future healthcare IT infrastructure.  

---

## 🛠️ Tech Stack
- **Backend Framework:** Django (Python)  
- **Frontend (planned):** Django Templates / (optional) React for scalability  
- **Database:**  
  - **Relational:** MySQL (transactional data such as sales, inventory, accounting)  
  - **NoSQL:** MongoDB (for logs, AI models, unstructured data)  
- **AI / ML:**  
  - OCR & Computer Vision (for invoice scanning)  
  - AI-driven recommendation engine (for patient medicine suggestions)  
- **Tools & Development:**  
  - VSCode + GitHub for version control  
  - Laragon (local server for MySQL)  
  - DBeaver (database management)  

---

## 📂 Project Structure
```

RaddinaHealthService/
│── backend/              # Django backend project
│   ├── manage.py
│   └── raddina\_backend/  # Core Django app and settings
│
│── database/             # Database schema and migrations
│   └── schema.sql
│
│── ai/                   # AI/ML models (OCR, recommendation engine)
│   └── ocr\_model/
│
│── docs/                 # Documentation, diagrams (ERD, UML, design notes)
│   └── ERD.png
│
│── tests/                # Unit and integration tests
│
│── README.md             # Project documentation

```

---

## 🚀 Planned Features
- ✅ User authentication & role-based access (admin, pharmacist, wholesaler, customer)  
- ✅ Pharmacy management (medicine stock, suppliers, transactions)  
- ✅ Accounting reports (sales, purchases, profit/loss)  
- ✅ AI-driven medicine recommendation engine  
- ✅ OCR-based invoice scanning with automatic database entry  
- ✅ RESTful APIs for future integration with external systems  

---

## 📅 Development Timeline (18 Weeks)
- **Weeks 1–2:** Planning, research, and setup (Django, MySQL, GitHub, AI tools)  
- **Weeks 3–6:** Core backend (user management, database schema, CRUD operations)  
- **Weeks 7–10:** Pharmacy & wholesaler modules + accounting features  
- **Weeks 11–13:** AI recommendation engine (basic model integration)  
- **Weeks 14–16:** OCR-based invoice scanning module  
- **Weeks 17–18:** Testing, documentation, deployment prep  

---

## 👤 Author
- GitHub: [Reiii0-0](https://github.com/Reiii0-0)  
- Organization: **Raddina Pharma**

---

## 📄 License
This project is licensed for **personal and educational use only**.  
Commercial use, redistribution, or modification for business purposes is **not permitted** without prior consent.



