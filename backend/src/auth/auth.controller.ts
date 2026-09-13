import { Body, Controller, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { JwtGuard } from './jwt.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseGuards(RateLimitGuard)
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post('login')
  @UseGuards(RateLimitGuard)
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @Patch('me')
  @UseGuards(JwtGuard)
  updateProfile(
    @Req() request: { user: { id: string } },
    @Body() body: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(request.user.id, body);
  }

  @Post('logout')
  logout() {
    return { loggedOut: true };
  }
}
