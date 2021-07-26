import React, { Component } from "react";
import "../style/login.css";

class Login extends Component {
    state = {
        user: "",
        pass: "",
        userValid: "none"
    }
    render() {
        return(
        <React.Fragment>
            <input type = "email" name="user" onBlur = {(event) => { this.setUser(event); }} placeholder="User Email"></input>
            <div style = {{ color: "Red", display: this.state.userValid }}>Please enter a valid email address</div>
            <input type = "password" name="pass" onChange = {(event) => { this.setPass(event); }} placeholder = "Password"></input>
        </React.Fragment>);
    }
    setUser = (event: any) => {
        if(event.target.value && (!event.target.value.includes("@") || !event.target.value.includes("."))) {
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
        this.setState({
            ...this.state,
            pass: event.target.value
        });
        console.log("User set as", this.state.pass);
        return this.state;
    }
}
export default Login;