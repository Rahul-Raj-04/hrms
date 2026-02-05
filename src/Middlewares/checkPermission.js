export const checkPermission = (...requiredPermissions) => {
  return (req, res, next) => {

    
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const { role, permissions = [] } = req.user;

    
    if (role === "admin" || permissions.includes("*")) {
      return next();
    }

    const hasPermission = requiredPermissions.some(p =>
      permissions.includes(p)
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    next();
  };
};
