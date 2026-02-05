const staffClients = new Map(); // staffId -> Set<res>
const adminClients = new Set(); // Set<res>


export const addSSEClient = ({ role, userId, res }) => {
  if (role === "admin") {
    adminClients.add(res);
    console.log("🟢 ADMIN CONNECTED | total:", adminClients.size);
    return;
  }

  const staffId = userId.toString();

  if (!staffClients.has(staffId)) {
    staffClients.set(staffId, new Set());
  }

  staffClients.get(staffId).add(res);

 
};


export const removeSSEClient = ({ role, userId, res }) => {
  if (role === "admin") {
    adminClients.delete(res);
    return;
  }

  const staffId = userId?.toString();
  if (!staffId) return;

  const clientSet = staffClients.get(staffId);
  if (!clientSet) return;

  clientSet.delete(res);

 

  if (clientSet.size === 0) {
    staffClients.delete(staffId);
    console.log("⚠️ STAFF ALL CONNECTIONS REMOVED", staffId);
  }
};

export const emitAttendanceUpdate = ({ staffId }) => {

  const key =
    typeof staffId === "string"
      ? staffId
      : staffId?._id
      ? staffId._id.toString()
      : staffId?.toString();

  if (!key) {
   
    return;
  }

 

  const staffSet = staffClients.get(key);
 

 
  if (staffSet) {
    for (const staffRes of staffSet) {
      try {
        staffRes.write(`event: attendance_updated\ndata: {}\n\n`);
        staffRes.flush?.();
        
      } catch {
        staffSet.delete(staffRes);
      }
    }
  } else {
    console.log("❌ NO STAFF SET FOUND");
  }

  // ---- admin ----
  for (const adminRes of adminClients) {
    try {
      adminRes.write(`event: attendance_updated\ndata: {}\n\n`);
      adminRes.flush?.();
      console.log("✅ sent to ADMIN");
    } catch {
      adminClients.delete(adminRes);
    }
  }

  console.log("📦 EMIT DONE\n");
};


export const emitNotification = ({
  audienceType,
  staffIds = [],
  departmentIds = [],
  payload,
}) => {
 
  if (audienceType === "all") {
    for (const [, staffSet] of staffClients) {
      for (const res of staffSet) {
        try {
          res.write(
            `event: notification\ndata: ${JSON.stringify(payload)}\n\n`
          );
          res.flush?.();
        } catch {
          staffSet.delete(res);
        }
      }
    }
    return;
  }

  
  if (audienceType === "individual") {
    staffIds.forEach((id) => {
      const key = id.toString();
      const staffSet = staffClients.get(key);

      if (staffSet) {
        for (const res of staffSet) {
          try {
            res.write(
              `event: notification\ndata: ${JSON.stringify(payload)}\n\n`
            );
            res.flush?.();
          } catch {
            staffSet.delete(res);
          }
        }
      }
    });
  }
  
   if (audienceType === "admin") {
     for (const adminRes of adminClients) {
       try {
         adminRes.write(`event: notification_created\ndata: {}\n\n`);
         adminRes.flush?.();
         console.log("🔔 ADMIN notification SSE sent");
       } catch {
         adminClients.delete(adminRes);
       }
     }
   }
};

export const emitForceLogout = ({ staffId, reason = "inactive" }) => {
  const key =
    typeof staffId === "string"
      ? staffId
      : staffId?._id
      ? staffId._id.toString()
      : staffId?.toString();

  if (!key) return;

  const staffSet = staffClients.get(key);

  if (staffSet) {
    for (const staffRes of staffSet) {
      try {
        staffRes.write(
          `event: force_logout\ndata: ${JSON.stringify({
            staffId: key,
            reason,
            ts: Date.now(),
          })}\n\n`
        );
        staffRes.flush?.();
      } catch {
        staffSet.delete(staffRes);
      }
    }
  }
};
