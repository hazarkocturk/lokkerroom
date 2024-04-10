export default (req, res, next)=>{
    console.log(`${new Date().toISOString()} - ${req.method} - ${req.hostname}`);
    next()
}