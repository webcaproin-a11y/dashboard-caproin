@echo off
curl.exe -k -X POST "https://ponypro.ibla.co:31406/all/invoice" ^
-H "Content-Type: application/json" ^
-H "token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI2OTEzNWEwNmQzYTFkOGE2MTBkNTU5NGEiLCJpYXQiOjE3ODAzMjA4MDIsImV4cCI6MTc4MTYxNjgwMn0.yo7Kbt97Qkp-IVKFaf4UhVjflg_SRZwph3-d1ymHJJs" ^
-d @request.json ^
-o temp_invoices.json
