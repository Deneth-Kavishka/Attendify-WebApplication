#!/usr/bin/env python3
"""
SmartTrack RFID System Launcher
Automated startup script for complete RFID attendance system

This script:
1. Checks system dependencies
2. Sets up virtual environment if needed
3. Installs required packages
4. Configures databases
5. Starts all required services
6. Monitors system health

Author: SmartTrack Team
Version: 3.0.0
"""

import os
import sys
import subprocess
import time
import json
import threading
import logging
from pathlib import Path

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('startup.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class SmartTrackLauncher:
    def __init__(self):
        self.base_dir = Path(__file__).parent
        self.venv_path = self.base_dir / "venv"
        self.services = {}
        
    def check_python_version(self):
        """Check if Python version is compatible"""
        version = sys.version_info
        if version.major < 3 or (version.major == 3 and version.minor < 8):
            logger.error("❌ Python 3.8+ is required")
            return False
        logger.info(f"✅ Python {version.major}.{version.minor}.{version.micro} detected")
        return True
    
    def check_system_dependencies(self):
        """Check required system dependencies"""
        logger.info("🔍 Checking system dependencies...")
        
        dependencies = {
            'git': 'git --version',
            'node': 'node --version',
            'npm': 'npm --version'
        }
        
        missing = []
        for dep, cmd in dependencies.items():
            try:
                subprocess.run(cmd.split(), capture_output=True, check=True)
                logger.info(f"✅ {dep} found")
            except (subprocess.CalledProcessError, FileNotFoundError):
                logger.warning(f"⚠️ {dep} not found")
                missing.append(dep)
        
        if missing:
            logger.warning(f"⚠️ Missing dependencies: {', '.join(missing)}")
            logger.info("💡 Some features may not work properly")
        
        return True
    
    def setup_virtual_environment(self):
        """Setup Python virtual environment"""
        if self.venv_path.exists():
            logger.info("✅ Virtual environment already exists")
            return True
        
        logger.info("📦 Creating virtual environment...")
        try:
            subprocess.run([sys.executable, '-m', 'venv', str(self.venv_path)], check=True)
            logger.info("✅ Virtual environment created")
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"❌ Failed to create virtual environment: {e}")
            return False
    
    def get_venv_python(self):
        """Get path to Python executable in virtual environment"""
        if os.name == 'nt':  # Windows
            return self.venv_path / "Scripts" / "python.exe"
        else:  # Unix/Linux
            return self.venv_path / "bin" / "python"
    
    def install_requirements(self):
        """Install Python requirements"""
        logger.info("📦 Installing Python requirements...")
        
        requirements_files = [
            'requirements_rfid_complete.txt',
            'requirements.txt',
            'requirements_final.txt'
        ]
        
        python_exe = self.get_venv_python()
        
        for req_file in requirements_files:
            req_path = self.base_dir / req_file
            if req_path.exists():
                try:
                    logger.info(f"Installing from {req_file}...")
                    subprocess.run([
                        str(python_exe), '-m', 'pip', 'install', '-r', str(req_path)
                    ], check=True, capture_output=True)
                    logger.info(f"✅ Installed requirements from {req_file}")
                    break
                except subprocess.CalledProcessError as e:
                    logger.warning(f"⚠️ Failed to install from {req_file}: {e}")
                    continue
        else:
            logger.warning("⚠️ No requirements file found, installing basic packages...")
            basic_packages = [
                'flask', 'flask-cors', 'websockets', 'psycopg2-binary', 
                'firebase-admin', 'python-dotenv'
            ]
            for package in basic_packages:
                try:
                    subprocess.run([
                        str(python_exe), '-m', 'pip', 'install', package
                    ], check=True, capture_output=True)
                    logger.info(f"✅ Installed {package}")
                except subprocess.CalledProcessError:
                    logger.warning(f"⚠️ Failed to install {package}")
    
    def check_firebase_config(self):
        """Check Firebase configuration"""
        firebase_key = self.base_dir / "firebase-service-account.json"
        if firebase_key.exists():
            logger.info("✅ Firebase service account key found")
            return True
        else:
            logger.warning("⚠️ Firebase service account key not found")
            logger.info("💡 Create firebase-service-account.json for Firebase integration")
            return False
    
    def check_database_connections(self):
        """Check database connections"""
        logger.info("🗄️ Checking database connections...")
        
        # Test PostgreSQL
        try:
            import psycopg2
            conn = psycopg2.connect(
                host='localhost',
                database='smarttrack_attendance',
                user='postgres',
                password='password'  # Update as needed
            )
            conn.close()
            logger.info("✅ PostgreSQL connection successful")
        except Exception as e:
            logger.warning(f"⚠️ PostgreSQL connection failed: {e}")
            logger.info("💡 SQLite will be used as fallback")
        
        # SQLite is always available
        logger.info("✅ SQLite database available")
        return True
    
    def start_rfid_service(self):
        """Start the main RFID service"""
        logger.info("🚀 Starting RFID service...")
        
        python_exe = self.get_venv_python()
        service_script = self.base_dir / "smarttrack_rfid_service.py"
        
        if not service_script.exists():
            logger.error("❌ RFID service script not found")
            return None
        
        try:
            process = subprocess.Popen([
                str(python_exe), str(service_script)
            ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            
            self.services['rfid_service'] = process
            logger.info("✅ RFID service started")
            return process
        except Exception as e:
            logger.error(f"❌ Failed to start RFID service: {e}")
            return None
    
    def start_nodejs_backend(self):
        """Start Node.js backend if available"""
        logger.info("🚀 Checking for Node.js backend...")
        
        server_dir = self.base_dir.parent / "server"
        if not server_dir.exists():
            logger.info("💡 Node.js backend not found, skipping...")
            return None
        
        package_json = server_dir / "package.json"
        if not package_json.exists():
            logger.info("💡 Node.js package.json not found, skipping...")
            return None
        
        try:
            # Install dependencies
            subprocess.run(['npm', 'install'], cwd=server_dir, check=True)
            
            # Start server
            process = subprocess.Popen(['npm', 'start'], cwd=server_dir)
            self.services['nodejs_backend'] = process
            logger.info("✅ Node.js backend started")
            return process
        except Exception as e:
            logger.warning(f"⚠️ Failed to start Node.js backend: {e}")
            return None
    
    def start_client_dev_server(self):
        """Start React client development server"""
        logger.info("🚀 Checking for React client...")
        
        client_dir = self.base_dir.parent / "client"
        if not client_dir.exists():
            logger.info("💡 React client not found, skipping...")
            return None
        
        package_json = client_dir / "package.json"
        if not package_json.exists():
            logger.info("💡 Client package.json not found, skipping...")
            return None
        
        try:
            # Install dependencies
            subprocess.run(['npm', 'install'], cwd=client_dir, check=True)
            
            # Start development server
            process = subprocess.Popen(['npm', 'run', 'dev'], cwd=client_dir)
            self.services['react_client'] = process
            logger.info("✅ React client development server started")
            return process
        except Exception as e:
            logger.warning(f"⚠️ Failed to start React client: {e}")
            return None
    
    def monitor_services(self):
        """Monitor running services"""
        logger.info("📊 Monitoring services...")
        
        while True:
            time.sleep(30)  # Check every 30 seconds
            
            for service_name, process in self.services.items():
                if process and process.poll() is not None:
                    logger.warning(f"⚠️ Service {service_name} has stopped")
                    # Optionally restart the service here
            
            logger.info(f"📊 Active services: {len([p for p in self.services.values() if p and p.poll() is None])}")
    
    def create_desktop_shortcut(self):
        """Create desktop shortcut for easy access"""
        if os.name == 'nt':  # Windows
            try:
                import winshell
                from win32com.client import Dispatch
                
                desktop = winshell.desktop()
                shortcut_path = os.path.join(desktop, "SmartTrack RFID Dashboard.lnk")
                
                shell = Dispatch('WScript.Shell')
                shortcut = shell.CreateShortCut(shortcut_path)
                shortcut.Targetpath = "http://localhost:5001"
                shortcut.IconLocation = "shell32.dll,13"
                shortcut.save()
                
                logger.info("✅ Desktop shortcut created")
            except Exception as e:
                logger.warning(f"⚠️ Could not create desktop shortcut: {e}")
    
    def display_startup_info(self):
        """Display startup information"""
        print("\n" + "="*60)
        print("🎯 SmartTrack RFID Attendance System")
        print("="*60)
        print("🌐 Web Dashboard: http://localhost:5001")
        print("📡 WebSocket Server: ws://localhost:3001")
        print("🔗 Device Connection: ws://localhost:3001/rfid-ws")
        print("="*60)
        print("\n📋 Quick Setup Checklist:")
        print("1. ✅ Update WiFi credentials in Arduino code")
        print("2. ✅ Set your PC's IP address in Arduino code")  
        print("3. ✅ Upload Arduino code to NodeMCU")
        print("4. ✅ Connect RFID hardware as per pinout")
        print("5. ✅ Configure Firebase (optional)")
        print("6. ✅ Setup PostgreSQL (optional)")
        print("\n🚀 System is ready! Connect your RFID devices.")
        print("="*60)
    
    def cleanup(self):
        """Cleanup on exit"""
        logger.info("🛑 Shutting down services...")
        
        for service_name, process in self.services.items():
            if process and process.poll() is None:
                try:
                    process.terminate()
                    process.wait(timeout=10)
                    logger.info(f"✅ {service_name} stopped")
                except subprocess.TimeoutExpired:
                    process.kill()
                    logger.warning(f"⚠️ Force killed {service_name}")
                except Exception as e:
                    logger.error(f"❌ Error stopping {service_name}: {e}")
        
        logger.info("✅ Cleanup completed")
    
    def run(self):
        """Main launcher sequence"""
        try:
            logger.info("🚀 Starting SmartTrack RFID System...")
            
            # Pre-flight checks
            if not self.check_python_version():
                return False
            
            self.check_system_dependencies()
            
            # Setup environment
            if not self.setup_virtual_environment():
                return False
            
            self.install_requirements()
            self.check_firebase_config()
            self.check_database_connections()
            
            # Start services
            self.start_rfid_service()
            
            # Optional services
            self.start_nodejs_backend()
            self.start_client_dev_server()
            
            # Create shortcuts and display info
            self.create_desktop_shortcut()
            self.display_startup_info()
            
            # Monitor services
            monitor_thread = threading.Thread(target=self.monitor_services, daemon=True)
            monitor_thread.start()
            
            # Keep running
            logger.info("✅ SmartTrack RFID System is running!")
            logger.info("Press Ctrl+C to stop...")
            
            while True:
                time.sleep(1)
                
        except KeyboardInterrupt:
            logger.info("🛑 Shutdown requested by user")
        except Exception as e:
            logger.error(f"❌ Fatal error: {e}")
        finally:
            self.cleanup()

if __name__ == "__main__":
    launcher = SmartTrackLauncher()
    launcher.run()
