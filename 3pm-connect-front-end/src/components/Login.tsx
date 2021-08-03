import React, { Component } from "react";
import "../style/login.css";

class Login extends Component {
    state = {
        user: "",
        pass: "",
        userValid: "none",
        passValid: "none"
    }
    render() {
        return(
        <React.Fragment>
            <input type = "email" name="user" onBlur = {(event) => { this.setUser(event); }} placeholder="User Email"></input>
            <div style = {{ color: "Red", marginTop: "5px", display: this.state.userValid }}>Please enter a valid email address</div>
            <input type = "password" name="pass" onBlur = {(event) => { this.setPass(event); }} placeholder = "Password"></input>
            <div style = {{ color: "Red", marginTop: "5px", display: this.state.passValid }}>A valid password is required</div><br></br>
            <div><button>Login</button></div>
        </React.Fragment>);
    }
    setUser = (event: any) => {
        if((event.target.value && (!event.target.value.includes("@") || !event.target.value.includes("."))) || !event.target.value) {
            this.setState({
                ...this.state,
                userValid: "block"
            });
            return this.state;
        }
        this.setState({
            ...this.state,
            user: event.target.value,
            userValid: "none"
        });
        console.log("User set as", this.state.user);
        return this.state;
    }
    setPass = (event: any) => {
        if(!event.target.value || event.target.value.length < 8) {
            this.setState({
                ...this.state,
                passValid: "block"
            });
            return this.state;
        }
        this.setState({
            ...this.state,
            pass: event.target.value,
            passValid: "none"
        });
        console.log("User set as", this.state.pass);
        return this.state;
    }
}
export default Login;