FROM python:3.11-slim

# Set working directory inside the container
WORKDIR /app

# Copy backend code into the container
COPY . /app

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Expose port your Flask app runs on
EXPOSE 5030

# Command to run the Flask app
CMD ["python", "app.py"]
