FROM python:3.12-slim
WORKDIR /srv
COPY pyproject.toml ./
RUN pip install --no-cache-dir . 
COPY app ./app
# ANALYSIS_SERVICE_TOKEN must be provided at runtime; the image contains no secrets.
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
