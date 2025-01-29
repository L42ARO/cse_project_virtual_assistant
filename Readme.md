# CSE PROJECT VIRTUAL ASSISTANT
![vite badge](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)
![react badge](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![WebSockets](https://img.shields.io/badge/WebSockets-0078D4?style=for-the-badge&logo=websocket&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white)


## Get Started: Frontend

To develop for the frontend, make sure you have node installed. If not go [here](https://nodejs.org/en)
Once you have it installed, follow these steps:
```shell
cd va_frontend
npm i
```

Then to run the frontend just do:
```shell
npm run dev
```

Then open the localhost link that shows up on your browser.

## Get Started: Backend

To develop for the backend, make sure you have python installed. And I would suggest to utilize a virtual environment if you don't want to make a mess of dependencies on your computer.

```shell
cd va_backend
python -m venv venv
./venv/Scripts/activate
pip install -r requirements.txt
```

To run the backend server just do:
```shell
python main.py
```
The backend will work as a standalone computer program so you will not need to necessarily follow the link it displays.

## Running together

To test the whole system run the frontend on one terminal, then run the backend in another terminal, and open the frontend on your browser, everything should be setup for them to work together via HTTP calls and WebSocket messages.

Technically speaking you could also run the whole system as a single program after building the frontend. It's not necesary, but [explained below](#building-for-production)

## Frontend Explained
The frontend is a React app, it utilizes Javascript to avoid the learning curve of Typescript. For simplicity purposes we will say that means the only folder we care about is `va_frontend/src`. 

The main program running the react app is `App.jsx`. Right now it's being used to define the routes to the differnt pages as well as giving the server context to all the pages, as well as organizing the navigation bar.

The next folder of most importance is the `src/pages`, if you want to start devloping *START HERE* given that any code that's modified you can easily see your changes without having to import it somewhere else. These pages can be modified however you want and it should reflect in raltime whilst running the app.

The other folder of importance is the `src/components`, given that sometimes some UI code will be reused across the application, we can use components to help isolate that code here to be used by multiple pages.

There is also the `src/assets` folder to save images and videos if needed.

Finally the last folder of importance is `src/context` this folder will contain anything related to communicating back to the server, especially the file `apiService.js` which contains functions to abstract any API calls to the server, if you develop a new end point on the backend, or want to use websockets in a different way feel free to modify this file so that it can then be used on one of the pages.


## Backend Explained

The backend is divided into 5 main categories: Controllers, Templates, Services, Data, Models. Trying to be similar to the MVC pattern.

The Controllers is any code related to HTTP endpoints or even Websocket listeners, therefore this is the go to place when modifying anything related with the API.

The Services is any code related to logic that can be separated from the Controllers, that's the more common programming of algoritms, functions to handle prompt engineering, etc. This code should ideally exist in isolation so that's easy to be tested and called by other parts of teh backend.

Data is where we will have class definitions that will dictate how tables will look in the database, this is not only so we keep consistency with the DB, but also such that when queries come back we can just use the classes in here to easily parse them into objects.

Finally Models is where we will have class definitions that will dictate how the API requests and responses will be structured, this is just helpful to have for JSON requests or resopnes that are complicated, or that are reused multiple times, it's a little harder in python given that there are no strict types.

## Building for production
The frontend can easily be built for production via:
```shell
cd va_frontend
npm run build
```

This will output a bunch of files in `va_frontend/dist`. These files can be placed in `va_backend/templates` and the whole app will run as a single unit. Granted there cannot be changes done to this "built" frontend.

For the backend to be ready for production it looks up an environment variable called production, if it exists it will run more optimal than usual. You can achieve this by running this on your terminal:
```shell
export PRODUCTION=true
python app.py
```
> NOTE: to keep developing is suggested to make PRODUCTION false
