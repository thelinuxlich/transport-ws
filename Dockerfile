FROM node:16
WORKDIR /app
COPY package*.json /app
RUN npm install
COPY . /app
EXPOSE 8080
CMD ["node", "./src/index.js"]