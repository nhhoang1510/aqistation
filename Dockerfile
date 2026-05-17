# Chạy cả 3 dịch vụ (InfluxDB, Telegraf, Grafana) trong 1 container để test trên Render
FROM ubuntu:22.04

# Bỏ qua các prompt hỏi cấu hình
ENV DEBIAN_FRONTEND=noninteractive

# Cài đặt các thư viện cần thiết
RUN apt-get update && apt-get install -y wget gnupg2 software-properties-common supervisor curl apt-transport-https

# 1. Cài đặt InfluxDB bằng file .deb (Tránh lỗi GPG Key)
RUN wget -q https://dl.influxdata.com/influxdb/releases/influxdb2-2.7.4-amd64.deb && \
    dpkg -i influxdb2-2.7.4-amd64.deb && rm influxdb2-2.7.4-amd64.deb

# 2. Cài đặt Telegraf bằng file .deb
RUN wget -q https://dl.influxdata.com/telegraf/releases/telegraf_1.28.3-1_amd64.deb && \
    dpkg -i telegraf_1.28.3-1_amd64.deb && rm telegraf_1.28.3-1_amd64.deb

# 3. Cài đặt Grafana bằng file .deb
RUN apt-get update && apt-get install -y adduser libfontconfig1 musl && \
    wget -q https://dl.grafana.com/oss/release/grafana_10.2.2_amd64.deb && \
    dpkg -i grafana_10.2.2_amd64.deb && rm grafana_10.2.2_amd64.deb

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
