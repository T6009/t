@echo off
cd /d E:\t\backend
echo Installing dependencies...
pip install -r requirements.txt -q
echo.
echo Starting Tetris server...
echo Open http://127.0.0.1:8765 in your browser
echo.
python app.py
pause
