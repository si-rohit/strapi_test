module.exports = async (ctx, next) => {
  const { id } = ctx.params; // Event ID from URL
  const user = ctx.state.user; // logged-in user

  // Find the event
  const event = await strapi.db.query('api::event.event').findOne({
    where: { id: id },
    populate: { user: true }, // populate user relation
  });

  if (!event) {
    return ctx.unauthorized('Event not found');
  }

  // Check if current user is the creator
  if (event.user.id !== user.id) {
    return ctx.unauthorized('You can only modify your own events');
  }

  return await next();
};
