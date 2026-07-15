

/**
 * 统一捕获报错
 * 
*/
export const asyncRoutes = (handler) => {
  return (req, res, next) => {
    void handler(req, res, next).catch(next);
  }
}