# Use an official Node.js runtime as a parent image
# Using LTS (Long Term Support) version is generally recommended for stability
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
# Copying these first leverages Docker cache
COPY package*.json ./

# Install app dependencies
# Use --only=production if you don't need devDependencies in the container
RUN npm install --only=production

# Create the database directory (if it doesn't get copied)
# Note: The actual database file should ideally be managed outside the container (e.g., using volumes)
# RUN mkdir -p database

# Copy the rest of the application code into the container
COPY . .

# Run the database setup script (only if you want to initialize the DB inside the container on build)
# Consider if this is the right place - usually, DB setup/migration is done at runtime or deployment time
# RUN node database/setup.js

# Make port 3000 available to the world outside this container
EXPOSE 3000

# Define the command to run the app
CMD [ "node", "server.js" ] 