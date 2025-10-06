# **QMail \- A Secure End-to-End Encrypted Email Client**

This project is a proof-of-concept, secure email application that demonstrates the principles of end-to-end encryption. The backend server acts as a "zero-knowledge" system that stores and delivers encrypted messages, but it can never read their content. All cryptographic operations (key generation, encryption, and decryption) happen exclusively on the client-side in the user's browser.

The user interface has been designed with a modern, dark-themed aesthetic.

## **Features**

* **User Registration & Login:** Create an account with a unique email address on the qmail.co.in domain.  
* **End-to-End Encryption:** Uses a placeholder for quantum-safe cryptography to encrypt messages before they leave the browser.  
* **Secure Key Management:** Private keys are generated and stored locally in the browser and are never sent to the server.  
* **Core Email Functionality:**  
  * Compose and send secure messages.  
  * An **Inbox** to view and decrypt received messages.  
  * A **Sent** folder to view sent messages.  
  * A placeholder for a future **Drafts** folder.  
* **Local Email Simulation:** Uses MailHog via Docker to catch and display outgoing email notifications for local development.

## **Technology Stack**

* **Backend:**  
  * **Framework:** FastAPI  
  * **Language:** Python  
  * **Database:** MongoDB (via MongoDB Atlas)  
  * **Async Driver:** Motor  
  * **Server:** Uvicorn  
* **Frontend:**  
  * HTML5  
  * CSS3  
  * Vanilla JavaScript (ES6+)  
* **Local Development:**  
  * **Email Catcher:** MailHog  
  * **Containerization:** Docker & Docker Compose

## **Setup and Running the Project**

To run this application, you need to set up the backend server, the MailHog service, and then open the frontend.

### **Prerequisites**

* [Python 3.8+](https://www.python.org/downloads/)  
* [Docker Desktop](https://www.docker.com/products/docker-desktop/)  
* A code editor like [Visual Studio Code](https://code.visualstudio.com/)

### **1\. Backend Setup**

1. **Navigate to the backend directory:**  
   cd qmail\_backend

2. **Create and activate a Python virtual environment:**  
   \# For macOS/Linux  
   python3 \-m venv venv  
   source venv/bin/activate

   \# For Windows  
   python \-m venv venv  
   venv\\Scripts\\activate

3. **Install the required libraries:**  
   pip install \-r requirements.txt

4. **Create the .env file:** Inside the qmail\_backend folder, create a file named .env and add your MongoDB Atlas connection string and MailHog configuration:  
   \# .env  
   MONGO\_CONNECTION\_STRING="mongodb+srv://\<username\>:\<password\>@cluster0.xxxxx.mongodb.net/?retryWrites=true\&w=majority"  
   MAIL\_USERNAME=  
   MAIL\_PASSWORD=  
   MAIL\_FROM=no-reply@qmail.co.in  
   MAIL\_PORT=1025  
   MAIL\_SERVER=localhost

5. **Run the FastAPI server:**  
   uvicorn main:app \--reload

   The backend will now be running at http://127.0.0.1:8000.

### **2\. MailHog Setup**

1. Make sure Docker Desktop is running.  
2. In a **new terminal**, navigate to the qmail\_backend directory.  
3. Run the following command:  
   docker-compose up \-d

   The MailHog web interface will now be available at http://localhost:8025.

### **3\. Frontend Setup**

1. Navigate to the qmail\_frontend directory.  
2. Open the index.html file in your web browser. (Using a tool like the "Live Server" extension in VS Code is recommended).

Your application is now fully running and ready for testing\!
