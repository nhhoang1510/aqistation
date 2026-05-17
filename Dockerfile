# Chạy cả 3 dịch vụ (InfluxDB, Telegraf, Grafana) trong 1 container để test trên Render
FROM ubuntu:22.04

# Bỏ qua các prompt hỏi cấu hình
ENV DEBIAN_FRONTEND=noninteractive

# Cài đặt các thư viện cần thiết
RUN apt-get update && apt-get install -y wget gnupg2 software-properties-common supervisor curl apt-transport-https

# 1. Cài đặt InfluxDB
RUN wget -q https://repos.influxdata.com/influxdata-archive_compat.key
RUN echo '393e8779c89ac8d958f81f942f9ad7fb82a25e133faddaf92e15b16e6ac9ce4c influxdata-archive_compat.key' | sha256sum -c && cat influxdata-archive_compat.key | gpg --dearmor | tee /etc/apt/trusted.gpg.d/influxdata-archive_compat.gpg > /dev/null
RUN echo 'deb [signed-by=/etc/apt/trusted.gpg.d/influxdata-archive_compat.gpg] https://repos.influxdata.com/debian stable main' | tee /etc/apt/sources.list.d/influxdata.list
RUN apt-get update && apt-get install -y influxdb2

# 2. Cài đặt Telegraf
RUN apt-get install -y telegraf

# 3. Cài đặt Grafana
RUN mkdir -p /etc/apt/keyrings/
RUN wget -q -O - https://apt.grafana.com/gpg.key | gpg --dearmor | tee /etc/apt/keyrings/grafana.gpg > /dev/null
RUN echo "deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com stable main" | tee /etc/apt/sources.list.d/grafana.list
RUN apt-get update && apt-get install -y grafana

# Copy file telegraf.conf của bạn vào container
# Trên Github, file telegraf.conf của bạn đang nằm ở thư mục gốc (ngang hàng với README)
COPY telegraf.conf /etc/telegraf/telegraf.conf

# Cấu hình Supervisor để chạy song song 3 tiến trình
RUN echo '[supervisord]\n\
nodaemon=true\n\
\n\
[program:influxdb]\n\
command=influxd\n\
stdout_logfile=/var/log/influxdb.log\n\
stderr_logfile=/var/log/influxdb_err.log\n\
\n\
[program:telegraf]\n\
command=telegraf --config /etc/telegraf/telegraf.conf\n\
stdout_logfile=/var/log/telegraf.log\n\
stderr_logfile=/var/log/telegraf_err.log\n\
\n\
[program:grafana]\n\
command=/usr/sbin/grafana-server --homepath=/usr/share/grafana --config=/etc/grafana/grafana.ini\n\
stdout_logfile=/var/log/grafana.log\n\
stderr_logfile=/var/log/grafana_err.log\n' > /etc/supervisor/conf.d/supervisord.conf

# Render yêu cầu dùng cổng do họ chỉ định, ta chỉnh Grafana chạy trên cổng đó (Render gán vào biến môi trường PORT)
# Cổng mặc định của InfluxDB vẫn là 8086 ở localhost bên trong container
ENV GF_SERVER_HTTP_PORT=10000
EXPOSE 10000

# Khởi chạy tất cả qua supervisor
CMD ["/usr/bin/supervisord"]
