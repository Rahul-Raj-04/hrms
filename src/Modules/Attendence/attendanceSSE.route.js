import express from "express";
import { authVerifyJWT } from "../../Middlewares/authVerifyJWT.js";
import { addSSEClient, removeSSEClient } from "../../Utils/sseManager.js";

const router = express.Router();

router.get("/stream", authVerifyJWT, (req, res) => {

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

 
  addSSEClient({
    role: req.user.role,
    userId: req.user.id,
    res,
  });


  res.write(`event: connected\ndata: {}\n\n`);

  const heartbeat = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(heartbeat);
    }
  }, 20000);


  req.on("close", () => {
    clearInterval(heartbeat);
    removeSSEClient({
      role: req.user.role,
      userId: req.user.id,
      res,
    });
  });
});

export default router;
