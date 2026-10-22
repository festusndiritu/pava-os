import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { NotificationsService } from './notifications.service.js';
import { FollowUpReminderService } from './follow-up-reminder.service.js';
import { SubscribeDto, UnsubscribeDto } from './dto/notifications.dto.js';

// Deliberately not module-gated: any signed-in user can switch notifications on for their own devices.
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private notifications: NotificationsService,
    private reminders: FollowUpReminderService,
  ) {}

  @Get()
  list(@Req() req: any, @Query('unread') unread?: string, @Query('limit') limit?: string) {
    return this.notifications.list(req.user.sub, { unreadOnly: unread === '1' || unread === 'true', limit: limit ? Number(limit) || undefined : undefined });
  }

  @Get('unread-count')
  unreadCount(@Req() req: any) {
    return this.notifications.unreadCount(req.user.sub);
  }

  @Post('read-all')
  readAll(@Req() req: any) {
    return this.notifications.markAllRead(req.user.sub);
  }

  @Post(':id/read')
  read(@Req() req: any, @Param('id') id: string) {
    return this.notifications.markRead(req.user.sub, id);
  }

  @Get('config')
  config() {
    return { ...this.notifications.getConfig(), reminderHour: this.reminders.reminderHour };
  }

  @Post('subscribe')
  subscribe(@Req() req: any, @Body() body: SubscribeDto, @Headers('user-agent') userAgent?: string) {
    return this.notifications.subscribe(req.user.sub, body, userAgent);
  }

  @Post('unsubscribe')
  unsubscribe(@Req() req: any, @Body() body: UnsubscribeDto) {
    return this.notifications.unsubscribe(req.user.sub, body.endpoint);
  }

  @Post('test')
  async test(@Req() req: any) {
    const result = await this.notifications.sendToUser(req.user.sub, {
      title: 'Pava OS',
      body: 'Notifications are working on this device.',
      url: '/leads',
      tag: 'pava-test',
    });
    if (result.delivered === 0) {
      throw new BadRequestException('No device could be reached — switch notifications on for this device first');
    }
    return result;
  }
}
