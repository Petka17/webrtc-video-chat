# General
Example based on this [tutorial](https://codelabs.developers.google.com/codelabs/webrtc-web/index.html)
 
# Generate certificates
```
openssl genrsa -out server-key.pem 1024
openssl req -new -key server-key.pem -out server-csr.pem
openssl x509 -req -in server-csr.pem -signkey server-key.pem -out server-cert.pem
```
