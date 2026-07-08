FROM python:3.12-slim

WORKDIR /app

# 依赖均为预编译 wheel（含 psycopg2-binary），无需 gcc/libpq-dev 编译环境
COPY requirements.txt .
RUN pip install --no-cache-dir -i https://mirrors.aliyun.com/pypi/simple/ -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "api_server:app", "--host", "0.0.0.0", "--port", "8000"]
