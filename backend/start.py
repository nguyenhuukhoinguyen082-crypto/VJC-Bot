import subprocess
import sys
import time
import os

from config import BRANDING

def main():
    airline_name = BRANDING.get('airline', {}).get('name', 'PTFS Airline')
    print(f"Starting {airline_name} Backend Services...")
    
    # Path setup
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    venv_python = os.path.join(backend_dir, ".venv", "Scripts", "python.exe")
    
    if not os.path.exists(venv_python):
        print(f"Warning: Virtual environment python not found at {venv_python}")
        venv_python = sys.executable

    # Start FastAPI
    print("Launching API on port 8000...")
    api_process = subprocess.Popen(
        [venv_python, "-m", "uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000", "--reload"],
        cwd=backend_dir
    )
    
    # Start Discord Bot
    print("Launching Discord Bot...")
    bot_process = subprocess.Popen(
        [venv_python, "bot/main.py"],
        cwd=backend_dir
    )
    
    try:
        while True:
            time.sleep(1)
            # Check if any process terminated unexpectedly
            if api_process.poll() is not None:
                print("API process terminated unexpectedly.")
                break
            if bot_process.poll() is not None:
                print("Bot process terminated unexpectedly.")
                break
    except KeyboardInterrupt:
        print("\nShutting down services...")
    finally:
        if api_process.poll() is None:
            api_process.terminate()
            api_process.wait()
        if bot_process.poll() is None:
            bot_process.terminate()
            bot_process.wait()
        print("All services stopped.")

if __name__ == "__main__":
    main()
