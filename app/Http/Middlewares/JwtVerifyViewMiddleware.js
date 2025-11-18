import jwt from 'jsonwebtoken';

export default function JwtVerifyViewMiddleware(request, response, next) {

    const HEADER_TEXT = "Aula 12 - Websockets";
    const { token } = request.cookies;

    console.log(request.cookies);

    if (!token) {
        return response.render("login", {
            header: HEADER_TEXT
        });
    }

    try {
        const userDecoded = jwt.verify(token, process.env.JWT_SECRET);

        request.user = userDecoded;
        return next();
    } catch (err) {
        return response.render("login", {
            header: HEADER_TEXT
        });
    }

}