import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AssistantRequestDto } from './dto/assistant-request.dto';
import { AssistantService } from './assistant.service';
import { RateLimitGuard } from '../auth/guards/rate-limit.guard';
@Controller('assistant')
export class AssistantController { constructor(private readonly assistant: AssistantService) {} @Get('capabilities') capabilities() { return { available: Boolean(process.env.AI_API_KEY), intents: ['PLACE_SEARCH', 'PLACE_DETAILS', 'NEARBY_PLACES', 'RECOMMENDATION', 'WEATHER', 'ROUTING', 'CITY_INFORMATION', 'ALERTS', 'GENERAL_CITY_QUERY'] }; } @Post() @UseGuards(RateLimitGuard) ask(@Body() request: AssistantRequestDto) { return this.assistant.ask(request); } }
