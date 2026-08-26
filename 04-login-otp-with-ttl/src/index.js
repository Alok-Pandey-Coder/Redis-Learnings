import express from "express"
import Redis from "ioredis"

const app = express();
app.use(express.json());
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379")

function otpKey(phone) {
  return `otp:${phone}`;
}

app.post('/otp', async (req, res) => {
  const { phone } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  await redis.set(otpKey(phone), otp, 'EX', 60);
  res.json({message: 'Otp sent', otp});
})

app.post('/otp/verify', async (req, res) => {
  const {phone, otp} = req.body;
  const savedOTP = await redis.get(otpKey(phone));

  if(!savedOTP) {
    return res.status(400).json({message: 'OTP expired or not found'})
  }

  if(savedOTP !== otp) {
    return res.status(400).json({message: 'Invalid otp'});
  }

  await redis.del(otpKey(phone));
  res.json({message: 'OTP verified successfully'});
})

app.get('/otp/:phone/ttl', async (req, res) => {
  const ttl = await redis.ttl(otpKey(req.params.phone));
  res.json({ttl});  
})

app.listen(3000, () => {
  console.log("application is running on http://localhost:3000");
})